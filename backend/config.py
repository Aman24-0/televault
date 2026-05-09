import os
from dotenv import load_dotenv
load_dotenv()

TELEGRAM_API_ID   = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")

# Your private storage channel ID (starts with -100...)
# How to get it:
#   Option 1: Add @userinfobot to your channel → it shows the ID
#   Option 2: Forward a message from your channel to @userinfobot
#   Option 3: Use the find_channel_id.py script from setup
# Leave empty to use Saved Messages ("me") as fallback
_ch = os.getenv("TELEGRAM_CHANNEL_ID", "").strip()
TELEGRAM_CHANNEL_ID = int(_ch) if _ch else None

JWT_SECRET        = os.getenv("JWT_SECRET", "changeme-generate-a-real-secret")
JWT_ALGORITHM     = "HS256"
JWT_EXPIRE_DAYS   = 30
FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:5173")
DB_PATH           = os.getenv("DB_PATH", "televault.db")
