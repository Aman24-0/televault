import io
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import DocumentAttributeFilename
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, TELEGRAM_CHANNEL_ID

_client: TelegramClient = None
_channel = None

async def init_telegram():
    global _client, _channel
    _client = TelegramClient(StringSession(TELEGRAM_SESSION), TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await _client.connect()
    if not await _client.is_user_authorized():
        raise RuntimeError("Telegram session expired! Re-run generate_session.py")
    _channel = await _client.get_entity(TELEGRAM_CHANNEL_ID)
    me = await _client.get_me()
    print(f"✅ Telegram connected as: {me.first_name}")

def get_client(): return _client
def get_channel(): return _channel

async def upload_file_to_telegram(file_bytes: bytes, filename: str, mime_type: str, progress_callback=None) -> dict:
    client  = get_client()
    channel = get_channel()
    file_obj = io.BytesIO(file_bytes)
    file_obj.name = filename
    message = await client.send_file(
        channel, file_obj,
        caption=f"📁 {filename}",
        attributes=[DocumentAttributeFilename(file_name=filename)],
        progress_callback=progress_callback,
        force_document=True,
    )
    return {"message_id": message.id, "file_id": str(message.file.id) if message.file else None}

async def upload_thumbnail_to_telegram(thumb_bytes: bytes, filename: str) -> int:
    client  = get_client()
    channel = get_channel()
    thumb_obj = io.BytesIO(thumb_bytes)
    thumb_obj.name = filename
    message = await client.send_file(channel, thumb_obj, caption=f"🖼 thumb:{filename}")
    return message.id

async def stream_file_from_telegram(message_id: int):
    client  = get_client()
    channel = get_channel()
    message = await client.get_messages(channel, ids=message_id)
    if not message or not message.media:
        return
    async for chunk in client.iter_download(message.media):
        yield chunk

async def get_thumbnail_bytes(thumb_message_id: int) -> bytes:
    client  = get_client()
    channel = get_channel()
    message = await client.get_messages(channel, ids=thumb_message_id)
    if not message or not message.media:
        return None
    return await client.download_media(message.media, bytes)

async def delete_telegram_message(message_id: int):
    client  = get_client()
    channel = get_channel()
    await client.delete_messages(channel, [message_id])
