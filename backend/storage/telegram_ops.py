"""
TeleVault v2 - Telegram Storage Operations

Storage target (in priority order):
  1. TELEGRAM_CHANNEL_ID from .env  → your private channel
  2. Fallback → "me" (Saved Messages)

Channel ID must be the full integer form: -1001234567890
Telethon handles negative int channel IDs natively.
"""
import io
from telethon import TelegramClient
from telethon.tl.types import DocumentAttributeFilename
from core.telegram_pool import get_client
from core.database import get_db
from config import TELEGRAM_CHANNEL_ID

# Resolve storage target once at import time
# If channel ID set → use channel, else → Saved Messages
STORAGE_ENTITY = TELEGRAM_CHANNEL_ID if TELEGRAM_CHANNEL_ID else "me"


async def _get_user_client(user_id: str) -> TelegramClient:
    db = await get_db()
    row = await (await db.execute(
        "SELECT session FROM users WHERE id=?", (user_id,)
    )).fetchone()
    if not row:
        raise ValueError("User not found")
    return await get_client(user_id, row["session"])


async def upload_file(
    user_id: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    progress_callback=None
) -> dict:
    client   = await _get_user_client(user_id)
    file_obj = io.BytesIO(file_bytes)
    file_obj.name = filename

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
    client  = await _get_user_client(user_id)
    obj     = io.BytesIO(thumb_bytes)
    obj.name = f"thumb_{filename}"
    msg = await client.send_file(
        STORAGE_ENTITY,
        obj,
        caption=f"🖼 thumb:{filename}"
    )
    return msg.id


async def stream_file(user_id: str, message_id: int):
    """Async generator — streams file chunks directly from Telegram."""
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
