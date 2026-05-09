import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db, row_to_dict
from core.security import create_token, get_current_user 
from core.telegram_pool import start_otp, verify_otp, remove_client

router = APIRouter()

# In-memory OTP hash store: phone -> phone_code_hash
_otp_store: dict = {}

class SendCodeRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None  # For 2FA users

@router.post("/send-code")
async def send_code(body: SendCodeRequest):
    phone = body.phone.strip()
    if not phone.startswith("+"):
        raise HTTPException(400, "Phone must include country code e.g. +91...")
    try:
        hash_ = await start_otp(phone)
        _otp_store[phone] = hash_
        return {"success": True, "message": "OTP sent to Telegram"}
    except Exception as e:
        raise HTTPException(400, f"Failed to send OTP: {e}")

@router.post("/verify-otp")
async def verify_otp_route(body: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    phone = body.phone.strip()
    hash_ = _otp_store.get(phone)
    if not hash_:
        raise HTTPException(400, "No OTP requested. Call /send-code first.")

    try:
        session_str, tg_user_id, first_name = await verify_otp(
            phone, body.code.strip(), hash_, body.password
        )
    except ValueError as e:
        if str(e) == "2FA_REQUIRED":
            raise HTTPException(428, "2FA password required")
        raise HTTPException(400, f"OTP verification failed: {e}")

    # Upsert user in DB using PostgreSQL (SQLAlchemy text format)
    user_id = secrets.token_urlsafe(16)

    # Check if user already exists by tg_user_id
    existing = await db.execute(
        text("SELECT id FROM users WHERE tg_user_id = :tg"),
        {"tg": tg_user_id}
    )
    row = existing.fetchone()

    if row:
        user_id = row._mapping["id"]
        await db.execute(
            text("UPDATE users SET session=:session, first_name=:fname, phone=:phone WHERE id=:uid"),
            {"session": session_str, "fname": first_name, "phone": phone, "uid": user_id}
        )
    else:
        await db.execute(
            text("INSERT INTO users (id, phone, first_name, tg_user_id, session) VALUES (:uid, :phone, :fname, :tg, :session)"),
            {"uid": user_id, "phone": phone, "fname": first_name, "tg": tg_user_id, "session": session_str}
        )

    await db.commit()

    # Clean up OTP store
    if phone in _otp_store:
        del _otp_store[phone]

    # create_token requires 2 arguments based on your utils.py
    token = create_token(user_id, first_name)
    
    return {
        "token": token,
        "user_id": user_id,
        "first_name": first_name,
        "phone": phone,
    }

@router.get("/me")
async def get_me(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("SELECT id, phone, first_name, created_at FROM users WHERE id=:uid"),
        {"uid": user["user_id"]}
    )
    row = res.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row_to_dict(row)

@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    await remove_client(user["user_id"])
    return {"success": True}