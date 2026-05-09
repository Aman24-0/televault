import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Engine setup with SSL and Timeout fixes
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "command_timeout": 60
    }
)

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    try:
        async with engine.begin() as conn:
            # Users Table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    phone TEXT UNIQUE NOT NULL,
                    first_name TEXT,
                    tg_user_id BIGINT UNIQUE,
                    session TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            # Folders Table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parent_id TEXT NOT NULL DEFAULT 'root',
                    user_id TEXT NOT NULL,
                    color TEXT DEFAULT '#818CF8',
                    is_trashed INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """))
            # Files Table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    original_name TEXT,
                    extension TEXT,
                    mime_type TEXT,
                    size_bytes BIGINT DEFAULT 0,
                    parent_id TEXT NOT NULL DEFAULT 'root',
                    user_id TEXT NOT NULL,
                    telegram_message_id INTEGER,
                    telegram_file_id TEXT,
                    thumbnail_msg_id INTEGER,
                    upload_status TEXT DEFAULT 'pending',
                    share_token TEXT,
                    share_enabled INTEGER DEFAULT 0,
                    is_trashed INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """))
        print("✅ Supabase Connected Successfully")
    except Exception as e:
        print(f"❌ Database Connection Error: {str(e)}")

# Helper functions for Routes
def row_to_dict(row):
    if row is None: return None
    return dict(row._mapping)

def rows_to_list(rows):
    return [dict(r._mapping) for r in rows]