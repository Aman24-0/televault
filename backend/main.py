from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from auth.routes import router as auth_router
from files.routes import router as files_router
from storage.routes import router as storage_router
from share.routes import router as share_router
from core.database import init_db
import uvicorn

app = FastAPI(title="TeleVault API")

# Updated CORS configuration for Netlify
origins = [
    "https://televaultv2.netlify.app",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # This creates the tables in Supabase if they don't exist
    await init_db()
    print("🚀 TeleVault Backend Started & Database Synced")

@app.get("/")
async def root():
    return {"status": "online", "message": "TeleVault API is running"}

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(files_router, prefix="/api/files", tags=["Files"])
app.include_router(storage_router, prefix="/api", tags=["Storage"])
app.include_router(share_router, prefix="/api/share", tags=["Share"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=10000, reload=True)