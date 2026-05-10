"""
TeleVault v2 - Storage Routes (PostgreSQL - fixed)
"""
import os, mimetypes, secrets
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import StreamingResponse
from core.database import get_db
from core.security import get_current_user, decode_token
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
    fid      = secrets.token_urlsafe(14)

    pool = await get_db()

    # Create pending record
    async with pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO files
               (id,name,original_name,extension,mime_type,size_bytes,parent_id,user_id,upload_status)
               VALUES ($1,$2,$3,$4,$5,0,$6,$7,'pending')""",
            fid, filename, filename, ext, mime, parent_id, uid
        )

    await ws_manager.send(uid, {"type": "upload_start", "file_id": fid, "filename": filename})

    try:
        data = await file.read()
        size = len(data)

        # 500MB limit
        if size > 500 * 1024 * 1024:
            async with pool.acquire() as conn:
                await conn.execute("DELETE FROM files WHERE id=$1", fid)
            raise HTTPException(413, "File too large. Maximum 500MB.")

        # Update size
        async with pool.acquire() as conn:
            await conn.execute("UPDATE files SET size_bytes=$1 WHERE id=$2", size, fid)

        # Progress callback
        async def on_progress(current, total):
            pct = round((current / total) * 100, 1)
            await ws_manager.send(uid, {"type": "upload_progress", "file_id": fid, "progress": pct})

        # Upload to Telegram
        tg = await upload_file(uid, data, filename, mime, on_progress)

        # Generate thumbnail
        thumb_id = None
        try:
            thumb = await generate_thumbnail(data, filename, mime)
            if thumb:
                thumb_id = await upload_thumbnail(uid, thumb, filename)
        except Exception as te:
            print(f"Thumbnail warning (non-fatal): {te}")

        # Mark complete
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """UPDATE files SET
                   upload_status='completed',
                   telegram_message_id=$1,
                   telegram_file_id=$2,
                   thumbnail_msg_id=$3
                   WHERE id=$4 RETURNING *""",
                tg["message_id"], tg["file_id"], thumb_id, fid
            )

        await ws_manager.send(uid, {"type": "upload_complete", "file_id": fid, "filename": filename})
        return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {e}")
        import traceback; traceback.print_exc()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE files SET upload_status='failed' WHERE id=$1", fid)
        await ws_manager.send(uid, {"type": "upload_failed", "file_id": fid, "error": str(e)})
        raise HTTPException(500, f"Upload failed: {str(e)}")


@router.get("/download/{file_id}")
async def download(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'",
            file_id, user["user_id"]
        )
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{row["name"]}"',
            "Content-Length": str(row.get("size_bytes", 0))
        }
    )


@router.get("/stream/{file_id}")
async def stream(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'",
            file_id, user["user_id"]
        )
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    )


@router.get("/stream-token/{file_id}")
async def stream_with_token(file_id: str, token: str = ""):
    payload = decode_token(token)
    if not payload: raise HTTPException(401, "Invalid token")
    user_id = payload["sub"]
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'",
            file_id, user_id
        )
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user_id, row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    )


@router.get("/thumbnail/{file_id}")
async def thumbnail(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT thumbnail_msg_id FROM files WHERE id=$1 AND user_id=$2",
            file_id, user["user_id"]
        )
    if not row or not row["thumbnail_msg_id"]:
        raise HTTPException(404, "No thumbnail")
    data = await get_thumbnail_bytes(user["user_id"], row["thumbnail_msg_id"])
    if not data: raise HTTPException(404, "Thumbnail not found")
    return StreamingResponse(
        iter([data]), media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


@router.get("/shared/info/{token}")
async def shared_info(token: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT name,size_bytes,mime_type,extension FROM files WHERE share_token=$1 AND share_enabled=1",
            token
        )
    if not row: raise HTTPException(404, "Link not found or disabled")
    return dict(row)


@router.get("/shared/download/{token}")
async def shared_download(token: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM files WHERE share_token=$1 AND share_enabled=1", token
        )
    if not row: raise HTTPException(404, "Link not found or disabled")
    row = dict(row)
    return StreamingResponse(
        stream_file(row["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{row["name"]}"',
            "Content-Length": str(row.get("size_bytes", 0))
        }
    )
