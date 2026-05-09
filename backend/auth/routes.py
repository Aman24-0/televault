"""
TeleVault v2 - Auth Routes
POST /api/auth/send-code   - Send OTP to phone
POST /api/auth/verify-otp  - Verify OTP -> JWT
GET  /api/auth/me          - Get current user
POST /api/auth/logout      - Logout
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
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

    # Upsert user in DB
    db = await get_db()
    user_id = secrets.token_urlsafe(16)

    # Check if user already exists by tg_user_id
    existing = await db.execute(
        "SELECT id FROM users WHERE tg_user_id = ?", (tg_user_id,)
    )
    row = await existing.fetchone()

    if row:
        user_id = row["id"]
        await db.execute(
            "UPDATE users SET session=?, first_name=?, phone=? WHERE id=?",
            (session_str, first_name, phone, user_id)
        )
    else:
        await db.execute(
            "INSERT INTO users (id, phone, first_name, tg_user_id, session) VALUES (?,?,?,?,?)",
            (user_id, phone, first_name, tg_user_id, session_str)
        )

    await db.commit()

    # Clean up OTP store
    del _otp_store[phone]

    token = create_token(user_id)
    return {
        "token": token,
        "user_id": user_id,
        "first_name": first_name,
        "phone": phone,
    }


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    db = await get_db()
    row = await (await db.execute(
        "SELECT id, phone, first_name, created_at FROM users WHERE id=?",
        (user["user_id"],)
    )).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return dict(row)


@router.post("/logout")
async def logout(user=Depends(get_current_user)):
    await remove_client(user["user_id"])
    return {"success": True}
