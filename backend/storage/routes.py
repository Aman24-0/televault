"""
TeleVault v2 - Storage Routes (PostgreSQL - fixed)
"""
import os, mimetypes, secrets, tempfile, zipfile, shutil
import anyio
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from core.database import get_db
from core.security import get_current_user, decode_token
from storage.telegram_ops import upload_file, upload_thumbnail, stream_file, get_thumbnail_bytes
from storage.thumbnail import generate_thumbnail
from websocket.manager import ws_manager

router = APIRouter()

async def process_telegram_upload(uid: str, file_id: str, filename: str, mime_type: str, temp_path: str):
    try:
        pool = await get_db()
        size = os.path.getsize(temp_path)

        async with pool.acquire() as conn:
            await conn.execute("UPDATE files SET size_bytes=$1 WHERE id=$2", size, file_id)

        async def on_progress(current, total):
            pct = 50 + round((current / total) * 50, 1)
            await ws_manager.send(uid, {"type": "upload_progress", "file_id": file_id, "progress": pct})

        tg = await upload_file(uid, temp_path, filename, mime_type, on_progress)

        thumb_id = None
        try:
            with open(temp_path, "rb") as f:
                thumb_data = f.read(10 * 1024 * 1024)
            thumb = await generate_thumbnail(thumb_data, filename, mime_type)
            if thumb:
                thumb_id = await upload_thumbnail(uid, thumb, filename)
        except Exception as te:
            pass

        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE files SET
                   upload_status='completed', telegram_message_id=$1,
                   telegram_file_id=$2, thumbnail_msg_id=$3
                   WHERE id=$4""",
                tg["message_id"], tg["file_id"], thumb_id, file_id
            )

        os.remove(temp_path)
        await ws_manager.send(uid, {"type": "upload_complete", "file_id": file_id, "filename": filename})

    except Exception as e:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("UPDATE files SET upload_status='failed' WHERE id=$1", file_id)
        await ws_manager.send(uid, {"type": "upload_failed", "file_id": file_id, "error": str(e)})
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/upload/chunk")
async def upload_chunk(
    file_id: str = Form(...),
    filename: str = Form(...),
    mime_type: str = Form(...),
    parent_id: str = Form("root"),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    user = Depends(get_current_user)
):
    uid = user["user_id"]
    pool = await get_db()
    temp_path = os.path.join(tempfile.gettempdir(), f"upload_{uid}_{file_id}.tmp")

    if chunk_index == 0:
        ext = os.path.splitext(filename)[1].lstrip(".").lower()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO files
                   (id,name,original_name,extension,mime_type,size_bytes,parent_id,user_id,upload_status)
                   VALUES ($1,$2,$3,$4,$5,0,$6,$7,'pending') ON CONFLICT (id) DO NOTHING""",
                file_id, filename, filename, ext, mime_type, parent_id, uid
            )
        if os.path.exists(temp_path):
            os.remove(temp_path)

    chunk_data = await file.read()
    with open(temp_path, "ab") as f:
        f.write(chunk_data)

    if chunk_index == total_chunks - 1:
        background_tasks.add_task(process_telegram_upload, uid, file_id, filename, mime_type, temp_path)
        return {"status": "processing"}

    return {"status": "chunk_received"}


@router.post("/upload")
async def upload(file: UploadFile=File(...), parent_id: str=Form("root"), user=Depends(get_current_user)):
    raise HTTPException(400, "Please use /upload/chunk endpoint for uploading files.")


@router.get("/download/{file_id}")
async def download(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'", file_id, user["user_id"])
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{row["name"]}"', "Content-Length": str(row.get("size_bytes", 0))}
    )

@router.get("/download/folder/{folder_id}")
async def download_folder(folder_id: str, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    pool = await get_db()
    uid = user["user_id"]

    async with pool.acquire() as conn:
        folder = await conn.fetchrow("SELECT name FROM folders WHERE id=$1 AND user_id=$2", folder_id, uid)
        if not folder: raise HTTPException(404, "Folder not found")
        files = await conn.fetch("SELECT * FROM files WHERE parent_id=$1 AND user_id=$2 AND upload_status='completed'", folder_id, uid)
        
    if not files: raise HTTPException(400, "Folder is empty, nothing to download")

    temp_dir = tempfile.mkdtemp()
    zip_filename = f"{folder['name']}.zip"
    zip_path = os.path.join(temp_dir, zip_filename)

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for f in files:
                file_path = os.path.join(temp_dir, f["name"])
                async with await anyio.open_file(file_path, 'wb') as out_file:
                    async for chunk in stream_file(uid, f["telegram_message_id"]):
                        await out_file.write(chunk)
                zipf.write(file_path, f["name"])
                os.remove(file_path)
                
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(500, f"Error creating zip: {str(e)}")

    def cleanup():
        shutil.rmtree(temp_dir, ignore_errors=True)
    background_tasks.add_task(cleanup)

    return FileResponse(
        zip_path, media_type="application/zip", filename=zip_filename,
        headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'}
    )

@router.get("/stream/{file_id}")
async def stream(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'", file_id, user["user_id"])
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"), headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    )

@router.get("/stream-token/{file_id}")
async def stream_with_token(file_id: str, token: str = ""):
    payload = decode_token(token)
    if not payload: raise HTTPException(401, "Invalid token")
    user_id = payload["sub"]
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM files WHERE id=$1 AND user_id=$2 AND upload_status='completed'", file_id, user_id)
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)
    return StreamingResponse(
        stream_file(user_id, row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"), headers={"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    )

@router.get("/thumbnail/{file_id}")
async def thumbnail(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT thumbnail_msg_id FROM files WHERE id=$1 AND user_id=$2", file_id, user["user_id"])
    if not row or not row["thumbnail_msg_id"]: raise HTTPException(404, "No thumbnail")
    data = await get_thumbnail_bytes(user["user_id"], row["thumbnail_msg_id"])
    if not data: raise HTTPException(404, "Thumbnail not found")
    return StreamingResponse(iter([data]), media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


# ── NEW: Advanced Secure Shared Endpoints ────────────────────

@router.get("/shared/info/{token}")
async def shared_info(token: str):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT name,size_bytes,mime_type,extension,share_enabled,share_expires_at,share_password FROM files WHERE share_token=$1", 
            token
        )
        
    if not row or row["share_enabled"] == 0: 
        raise HTTPException(404, "Link not found or disabled")
        
    if row["share_expires_at"] and row["share_expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(403, "This share link has expired")
        
    return {
        "name": row["name"],
        "size_bytes": row["size_bytes"],
        "mime_type": row["mime_type"],
        "extension": row["extension"],
        "requires_password": bool(row["share_password"])
    }

@router.get("/shared/download/{token}")
async def shared_download(token: str, pwd: str = ""):
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM files WHERE share_token=$1", token)
        
    if not row or row["share_enabled"] == 0: 
        raise HTTPException(404, "Link not found or disabled")
        
    if row["share_expires_at"] and row["share_expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(403, "This share link has expired")
        
    if row["share_password"] and row["share_password"] != pwd:
        raise HTTPException(401, "Incorrect password")
        
    return StreamingResponse(
        stream_file(row["user_id"], row["telegram_message_id"]),
        media_type=row.get("mime_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{row["name"]}"', "Content-Length": str(row.get("size_bytes", 0))}
    )