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

class FirebaseLoginRequest(BaseModel):
    uid: str
    email: str
    displayName: Optional[str] = None
    photoURL: Optional[str] = None


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


@router.post("/firebase-login")
async def firebase_login(body: FirebaseLoginRequest):
    pool = await get_db()
    user_id = body.uid
    
    # We need a Telegram session for the app to function. 
    # Since we are replacing the login flow but keeping the storage logic,
    # we'll use a placeholder or the existing session if it exists.
    # IMPORTANT: In a real scenario, you'd link the Firebase user to a Telegram session.
    # For this task, we'll ensure the user exists in the DB so the dashboard works.
    
    async with pool.acquire() as db:
        existing = await db.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
        
        if not existing:
            # Create a dummy Telegram session if none exists to satisfy the NOT NULL constraint
            # and allow the app to function. In a real app, the user would still need to 
            # connect their Telegram account.
            dummy_session = "PLACEHOLDER_SESSION" 
            await db.execute(
                "INSERT INTO users (id, phone, first_name, tg_user_id, session) VALUES ($1, $2, $3, $4, $5)",
                user_id, body.email, body.displayName or "User", 0, dummy_session
            )
        else:
            await db.execute(
                "UPDATE users SET first_name=$1 WHERE id=$2",
                body.displayName or "User", user_id
            )

    token = create_token(user_id)
    return {
        "token": token, 
        "user_id": user_id, 
        "first_name": body.displayName or "User",
        "email": body.email,
        "photoURL": body.photoURL
    }


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
