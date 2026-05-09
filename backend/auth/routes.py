import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db
from core.security import create_token
from core.telegram_pool import start_otp, verify_otp

router = APIRouter()
_otp_store: dict = {}

class SendCodeRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None

@router.post("/send-code")
async def send_code(body: SendCodeRequest):
    phone = body.phone.strip()
    try:
        hash_ = await start_otp(phone)
        _otp_store[phone] = hash_
        return {"success": True, "message": "OTP sent"}
    except Exception as e:
        raise HTTPException(400, f"Error: {e}")

@router.post("/verify-otp")
async def verify_otp_route(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    phone = body.phone.strip()
    hash_ = _otp_store.get(phone)
    if not hash_: raise HTTPException(400, "OTP not found")

    try:
        session_str, tg_id, fname = await verify_otp(phone, body.code, hash_, body.password)
    except ValueError as e:
        if str(e) == "2FA_REQUIRED": raise HTTPException(428, "2FA needed")
        raise HTTPException(400, str(e))

    try:
        uid = secrets.token_urlsafe(16)
        res = await db.execute(text("SELECT id FROM users WHERE tg_user_id = :tg"), {"tg": tg_id})
        row = res.fetchone()

        if row:
            uid = row[0]
            await db.execute(text("UPDATE users SET session=:s, first_name=:f, phone=:p WHERE id=:u"),
                {"s": session_str, "f": fname, "p": phone, "u": uid})
        else:
            await db.execute(text("INSERT INTO users (id, phone, first_name, tg_user_id, session) VALUES (:u, :p, :f, :tg, :s)"),
                {"u": uid, "p": phone, "f": fname, "tg": tg_id, "s": session_str})
        
        await db.commit()
    except Exception as e:
        print(f"CRITICAL DB ERROR: {e}")
        raise HTTPException(500, f"Database save failed: {e}")

    if phone in _otp_store: del _otp_store[phone]
    # Fixed: Only passing uid to match core/security.py definition
    token = create_token(uid) 
    return {"token": token, "user_id": uid, "first_name": fname}