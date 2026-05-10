"""
TeleVault v2 - Auth Routes (PostgreSQL version)
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.database import get_db, row_to_dict
from core.security import create_token, get_current_user
from core.telegram_pool import start_otp, verify_otp, remove_client

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
    if not phone.startswith("+"):
        raise HTTPException(400, "Phone must include country code e.g. +91...")
    try:
        hash_ = await start_otp(phone)
        _otp_store[phone] = hash_
        return {"success": True, "message": "OTP sent to Telegram"}
    except Exception as e:
        raise HTTPException(400, f"Failed to send OTP: {e}")


@router.post("/verify-otp")
async def verify_otp_route(body: VerifyOTPRequest):
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

    pool = await get_db()
    user_id = secrets.token_urlsafe(16)

    async with pool.acquire() as db:
        existing = await db.fetchrow(
            "SELECT id FROM users WHERE tg_user_id=$1", tg_user_id
        )
        if existing:
            user_id = existing["id"]
            await db.execute(
                "UPDATE users SET session=$1, first_name=$2, phone=$3 WHERE id=$4",
                session_str, first_name, phone, user_id
            )
        else:
            await db.execute(
                "INSERT INTO users (id,phone,first_name,tg_user_id,session) VALUES ($1,$2,$3,$4,$5)",
                user_id, phone, first_name, tg_user_id, session_str
            )

    del _otp_store[phone]
    token = create_token(user_id)
    return {"token": token, "user_id": user_id, "first_name": first_name, "phone": phone}


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "SELECT id, phone, first_name, created_at FROM users WHERE id=$1",
            user["user_id"]
        )
    if not row: raise HTTPException(404, "User not found")
    return dict(row)


@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    await remove_client(user["user_id"])
    return {"success": True}
