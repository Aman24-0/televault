"""
TeleVault v2 - Telegram Client Pool
Each user has their OWN Telegram client with their OWN session.
No shared channel. No shared storage.
"""
import asyncio
from typing import Dict, Optional
from telethon import TelegramClient
from telethon.sessions import StringSession
from config import TELEGRAM_API_ID, TELEGRAM_API_HASH

# Active client pool: user_id -> TelegramClient
_pool: Dict[str, TelegramClient] = {}

# Pending OTP sessions: phone -> TelegramClient (before login complete)
_pending: Dict[str, TelegramClient] = {}

async def get_client(user_id: str, session_string: str) -> TelegramClient:
    """Get or create a client for an authenticated user"""
    if user_id in _pool:
        client = _pool[user_id]
        if client.is_connected():
            return client
    
    client = TelegramClient(
        StringSession(session_string),
        TELEGRAM_API_ID,
        TELEGRAM_API_HASH
    )
    await client.connect()
    _pool[user_id] = client
    return client

async def start_otp(phone: str) -> str:
    """Start OTP flow. Returns phone_code_hash."""
    client = TelegramClient(StringSession(), TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await client.connect()
    result = await client.send_code_request(phone)
    _pending[phone] = client
    return result.phone_code_hash

async def verify_otp(phone: str, code: str, phone_code_hash: str, password: str = None):
    """
    Verify OTP. Returns (session_string, tg_user_id, first_name).
    Raises on failure.
    """
    client = _pending.get(phone)
    if not client:
        raise ValueError("Session expired. Request OTP again.")
    
    try:
        from telethon.errors import SessionPasswordNeededError
        try:
            await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)
        except SessionPasswordNeededError:
            if not password:
                raise ValueError("2FA_REQUIRED")
            await client.sign_in(password=password)
        
        me = await client.get_me()
        session_string = client.session.save()
        
        del _pending[phone]
        return session_string, me.id, me.first_name or me.username or "User"
    
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(str(e))

async def remove_client(user_id: str):
    """Disconnect and remove client"""
    if user_id in _pool:
        try:
            await _pool[user_id].disconnect()
        except:
            pass
        del _pool[user_id]
