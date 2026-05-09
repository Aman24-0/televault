"""
TeleVault v2 - Storage Routes
Upload, Download, Stream, Thumbnail, Share
"""
import os, mimetypes, secrets
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse
from core.database import get_db
from core.security import get_current_user
from storage.telegram_ops import upload_file, upload_thumbnail, stream_file, get_thumbnail_bytes
from storage.thumbnail import generate_thumbnail
from websocket.manager import ws_manager

router = APIRouter()


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    parent_id: str = Form("root"),
    user=Depends(get_current_user)
):
    uid      = user["user_id"]
    filename = file.filename or "untitled"
    mime     = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    ext      = os.path.splitext(filename)[1].lstrip(".").lower()

    # Create pending record
    db = await get_db()
    fid = secrets.token_urlsafe(14)
    await db.execute(
        """INSERT INTO files (id,name,original_name,extension,mime_type,size_bytes,parent_id,user_id,upload_status)
           VALUES (?,?,?,?,?,0,?,?,'pending')""",
        (fid, filename, filename, ext, mime, parent_id, uid)
    )
    await db.commit()

    await ws_manager.send(uid, {"type":"upload_start","file_id":fid,"filename":filename,"size_bytes":0})

    try:
        data = await file.read()
        size = len(data)

        # 500MB limit
        MAX_SIZE = 500 * 1024 * 1024
        if size > MAX_SIZE:
            await db.execute("DELETE FROM files WHERE id=?", (fid,))
            await db.commit()
            raise HTTPException(413, "File too large. Maximum size is 500MB.")

        # Update size
        await db.execute("UPDATE files SET size_bytes=? WHERE id=?", (size, fid))
        await db.commit()

        # Progress callback
        async def on_progress(current, total):
            pct = round((current / total) * 100, 1)
            await ws_manager.send(uid, {"type":"upload_progress","file_id":fid,"progress":pct})

        # Upload to Telegram (user's own Saved Messages)
        tg = await upload_file(uid, data, filename, mime, on_progress)

        # Generate & upload thumbnail
        thumb_id = None
        thumb = await generate_thumbnail(data, filename, mime)
        if thumb:
            thumb_id = await upload_thumbnail(uid, thumb, filename)

        # Mark complete
        await db.execute(
            """UPDATE files SET upload_status='completed',
               telegram_message_id=?,telegram_file_id=?,thumbnail_msg_id=?
               WHERE id=?""",
            (tg["message_id"], tg["file_id"], thumb_id, fid)
        )
        await db.commit()

        await ws_manager.send(uid, {"type":"upload_complete","file_id":fid,"filename":filename})
        row = await (await db.execute("SELECT * FROM files WHERE id=?", (fid,))).fetchone()
        return dict(row)

    except Exception as e:
        await db.execute("UPDATE files SET upload_status='failed' WHERE id=?", (fid,))
        await db.commit()
        await ws_manager.send(uid, {"type":"upload_failed","file_id":fid,"error":str(e)})
        raise HTTPException(500, f"Upload failed: {e}")


@router.get("/download/{file_id}")
async def download(file_id: str, user=Depends(get_current_user)):
    db  = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE id=? AND user_id=? AND upload_status='completed'",
        (file_id, user["user_id"])
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type","application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{row["name"]}"',
            "Content-Length": str(row.get("size_bytes",0))
        }
    )


@router.get("/stream/{file_id}")
async def stream(file_id: str, user=Depends(get_current_user)):
    db  = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE id=? AND user_id=? AND upload_status='completed'",
        (file_id, user["user_id"])
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type","application/octet-stream"),
        headers={"Accept-Ranges":"bytes","Cache-Control":"no-store"}
    )


@router.get("/thumbnail/{file_id}")
async def thumbnail(file_id: str, user=Depends(get_current_user)):
    db  = await get_db()
    row = await (await db.execute(
        "SELECT thumbnail_msg_id FROM files WHERE id=? AND user_id=?",
        (file_id, user["user_id"])
    )).fetchone()
    if not row or not row["thumbnail_msg_id"]: raise HTTPException(404, "No thumbnail")
    data = await get_thumbnail_bytes(user["user_id"], row["thumbnail_msg_id"])
    if not data: raise HTTPException(404, "Thumbnail not found")
    return StreamingResponse(iter([data]), media_type="image/jpeg",
        headers={"Cache-Control":"public, max-age=86400"})


# ── Public share endpoints (no auth) ───────────────────────

@router.get("/shared/info/{token}")
async def shared_info(token: str):
    db  = await get_db()
    row = await (await db.execute(
        "SELECT name,size_bytes,mime_type,extension FROM files WHERE share_token=? AND share_enabled=1",
        (token,)
    )).fetchone()
    if not row: raise HTTPException(404, "Link not found or disabled")
    return dict(row)


@router.get("/shared/download/{token}")
async def shared_download(token: str):
    db  = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE share_token=? AND share_enabled=1", (token,)
    )).fetchone()
    if not row: raise HTTPException(404, "Link not found or disabled")
    row = dict(row)
    return StreamingResponse(
        stream_file(row["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type","application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{row["name"]}"',
            "Content-Length": str(row.get("size_bytes",0))
        }
    )


@router.get("/stream-token/{file_id}")
async def stream_with_token(file_id: str, token: str = ""):
    """Stream endpoint that accepts token as query param for HTML5 media elements"""
    from core.security import decode_token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload["sub"]
    db  = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE id=? AND user_id=? AND upload_status='completed'",
        (file_id, user_id)
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user_id, row["telegram_message_id"]),
        media_type=row.get("mime_type","application/octet-stream"),
        headers={"Accept-Ranges":"bytes","Cache-Control":"no-store"}
    )
