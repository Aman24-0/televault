import os
from dotenv import load_dotenv
load_dotenv()

TELEGRAM_API_ID   = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")

_ch = os.getenv("TELEGRAM_CHANNEL_ID", "").strip()
TELEGRAM_CHANNEL_ID = int(_ch) if _ch else None

JWT_SECRET        = os.getenv("JWT_SECRET", "changeme-generate-a-real-secret")
JWT_ALGORITHM     = "HS256"
JWT_EXPIRE_DAYS   = 30
FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Add these if you still need Firebase, otherwise remove the imports in firestore.py
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")
FIREBASE_CLIENT_EMAIL = os.getenv("FIREBASE_CLIENT_EMAIL", "")
FIREBASE_PRIVATE_KEY = os.getenv("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")