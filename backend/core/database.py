"""
TeleVault v2 - Supabase PostgreSQL
Free, persistent, never deletes on redeploy
"""
import asyncpg
import os

_pool = None

async def get_db():
    global _pool
    if _pool is None:
        DATABASE_URL = os.getenv("DATABASE_URL", "")
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL not set. Add Supabase connection string.")
        _pool = await asyncpg.create_pool(DATABASE_URL, ssl="require")
        print("✅ Connected to Supabase PostgreSQL")
    return _pool

async def init_db():
    pool = await get_db()
    async with pool.acquire() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                phone       TEXT UNIQUE NOT NULL,
                first_name  TEXT,
                tg_user_id  BIGINT UNIQUE,
                session     TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS folders (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                parent_id   TEXT NOT NULL DEFAULT 'root',
                user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                color       TEXT DEFAULT '#818CF8',
                created_at  TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS files (
                id                  TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                original_name       TEXT,
                extension           TEXT,
                mime_type           TEXT,
                size_bytes          BIGINT DEFAULT 0,
                parent_id           TEXT NOT NULL DEFAULT 'root',
                user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                telegram_message_id BIGINT,
                telegram_file_id    TEXT,
                thumbnail_msg_id    BIGINT,
                upload_status       TEXT DEFAULT 'pending',
                share_token         TEXT,
                share_enabled       INTEGER DEFAULT 0,
                created_at          TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_files_user_parent   ON files(user_id, parent_id);
            CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id);
            CREATE INDEX IF NOT EXISTS idx_files_share_token   ON files(share_token);
        """)
    print("✅ Database tables ready")

async def row_to_dict(row) -> dict:
    if row is None: return None
    return dict(row)

async def rows_to_list(rows) -> list:
    return [dict(r) for r in rows]
