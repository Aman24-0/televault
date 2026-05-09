import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

# Render environment se URL uthayega
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        # Tables initialize karne ke liye commands
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
        # (Yahan aapke folders aur files tables ka SQL code bhi aayega)
    print("✅ PostgreSQL initialized")

def row_to_dict(row):
    if row is None: return None
    return dict(row._mapping)

def rows_to_list(rows):
    return [dict(r._mapping) for r in rows]