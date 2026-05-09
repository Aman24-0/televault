"""
TeleVault v2 - Main App
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv
load_dotenv()

from core.database import init_db
from auth.routes import router as auth_router
from files.routes import router as files_router
from storage.routes import router as storage_router
from websocket.manager import router as ws_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="TeleVault API v2", version="2.0.0", lifespan=lifespan)

# CORS - allow configured frontend + localhost for dev
FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:4173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/api/auth",  tags=["Auth"])
app.include_router(files_router,   prefix="/api",       tags=["Files"])
app.include_router(storage_router, prefix="/api",       tags=["Storage"])
app.include_router(ws_router,                           tags=["WebSocket"])

@app.get("/")
async def root():
    return {"status": "TeleVault v2 ✅", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"ok": True}
