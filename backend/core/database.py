import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Engine setup with Supabase specific fixes
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,      # Connection drop hone se bachata hai
    pool_recycle=300,        # Purane connections ko refresh karta hai
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
            # Tables initialize karne ke liye SQL
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id          TEXT PRIMARY KEY,
                    phone       TEXT UNIQUE NOT NULL,
                    first_name  TEXT,
                    tg_user_id  BIGINT UNIQUE,
                    session     TEXT NOT NULL,
                    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            # Baaki tables (folders/files) bhi yahan add karein...
        print("✅ Supabase Database Connected & Initialized")
    except Exception as e:
        print(f"❌ Database Connection Error: {e}")
        # Isse app crash nahi hogi balki error dikhayegi