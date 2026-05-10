"""
TeleVault v2 - Telegram Storage Operations (PostgreSQL version)
"""
import io
from telethon import TelegramClient
from telethon.tl.types import DocumentAttributeFilename
from core.telegram_pool import get_client

STORAGE_ENTITY = "me"


async def _get_user_client(user_id: str) -> TelegramClient:
    """Get Telegram client for user — fetches session from PostgreSQL"""
    from core.database import get_db
    pool = await get_db()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT session FROM users WHERE id=$1", user_id
        )
    if not row:
        raise ValueError(f"User not found: {user_id}")
    session_str = row["session"]
    return await get_client(user_id, session_str)


async def upload_file(
    user_id: str,
    file_data, # NEW: Can be bytes or str (filepath) for chunked uploads
    filename: str,
    mime_type: str,
    progress_callback=None
) -> dict:
    client   = await _get_user_client(user_id)
    
    # Check if data is bytes (old method) or file path (new method)
    if isinstance(file_data, bytes):
        file_obj = io.BytesIO(file_data)
        file_obj.name = filename
    else:
        file_obj = file_data # Telethon supports reading directly from filepath string
        
    message = await client.send_file(
        STORAGE_ENTITY,
        file_obj,
        caption=f"📁 {filename}",
        attributes=[DocumentAttributeFilename(file_name=filename)],
        progress_callback=progress_callback,
        force_document=True,
    )
    return {
        "message_id": message.id,
        "file_id":    str(message.file.id) if message.file else None,
    }


async def upload_thumbnail(user_id: str, thumb_bytes: bytes, filename: str) -> int:
    client   = await _get_user_client(user_id)
    obj      = io.BytesIO(thumb_bytes)
    obj.name = f"thumb_{filename}"
    msg = await client.send_file(STORAGE_ENTITY, obj, caption=f"🖼 thumb:{filename}")
    return msg.id


async def stream_file(user_id: str, message_id: int):
    client  = await _get_user_client(user_id)
    message = await client.get_messages(STORAGE_ENTITY, ids=message_id)
    if not message or not message.media:
        return
    async for chunk in client.iter_download(message.media):
        yield chunk


async def get_thumbnail_bytes(user_id: str, thumb_message_id: int) -> bytes:
    client  = await _get_user_client(user_id)
    message = await client.get_messages(STORAGE_ENTITY, ids=thumb_message_id)
    if not message or not message.media:
        return None
    return await client.download_media(message.media, bytes)


async def delete_messages(user_id: str, message_ids: list):
    if not message_ids:
        return
    client = await _get_user_client(user_id)
    await client.delete_messages(STORAGE_ENTITY, message_ids)