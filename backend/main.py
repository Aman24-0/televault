"""
TeleVault v2 - Main App (Stable Version)
CORS, Database Initialization, and Route Management
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from core.database import init_db
from auth.routes import router as auth_router
from files.routes import router as files_router
from storage.routes import router as storage_router
from websocket.manager import router as ws_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    App start hote hi database tables initialize karega.
    Supabase connection check isi function se hota hai.
    """
    try:
        await init_db()
        print("🚀 TeleVault Backend Started & Database Synced")
    except Exception as e:
        print(f"❌ Critical Startup Error: {e}")
    yield

app = FastAPI(
    title="TeleVault API v2", 
    version="2.0.0", 
    lifespan=lifespan
)

# --- DYNAMIC CORS SETUP ---
# Frontend URLs jo backend se communicate kar sakte hain
ALLOWED_ORIGINS = [
    "https://televaultv2.netlify.app",
    "http://localhost:5173",
    "http://localhost:4173",
]

# Agar .env mein FRONTEND_URL define hai toh use bhi add karein
env_frontend = os.getenv("FRONTEND_URL")
if env_frontend:
    if env_frontend.endswith('/'):
        env_frontend = env_frontend[:-1]
    if env_frontend not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(env_frontend)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"] # Streaming aur download headers ke liye zaroori
)

# --- ROUTER REGISTRATION ---
# Sabhi API endpoints ko yahan register kiya gaya hai
app.include_router(auth_router,    prefix="/api/auth",  tags=["Auth"])
app.include_router(files_router,   prefix="/api",       tags=["Files"])
app.include_router(storage_router, prefix="/api",       tags=["Storage"])
app.include_router(ws_router,                           tags=["WebSocket"])

@app.get("/")
async def root():
    """Root endpoint to check API status"""
    return {
        "status": "TeleVault v2 ✅", 
        "version": "2.0.0",
        "database": "PostgreSQL (Supabase)"
    }

@app.get("/health")
async def health():
    """Health check endpoint for Render/Monitoring"""
    return {"ok": True}