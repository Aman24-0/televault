"""
TeleVault v2 - Turso (LibSQL) Database
Persistent cloud SQLite — survives Render redeploys
"""
import libsql_experimental as libsql
import os
from config import DB_PATH

# Turso cloud config
TURSO_URL   = os.getenv("TURSO_URL", "")
TURSO_TOKEN = os.getenv("TURSO_TOKEN", "")

_db = None

async def get_db():
    global _db
    if _db is not None:
        return _db

    if TURSO_URL and TURSO_TOKEN:
        # Cloud Turso
        _db = libsql.connect(
            database=TURSO_URL,
            auth_token=TURSO_TOKEN,
        )
        print("✅ Connected to Turso cloud database")
    else:
        # Local fallback (development)
        _db = libsql.connect(DB_PATH)
        print("⚠️  Using local SQLite (data will reset on redeploy)")

    await _init_tables(_db)
    return _db


async def _init_tables(db):
    await db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            phone       TEXT UNIQUE NOT NULL,
            first_name  TEXT,
            tg_user_id  INTEGER UNIQUE,
            session     TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            parent_id   TEXT NOT NULL DEFAULT 'root',
            user_id     TEXT NOT NULL,
            color       TEXT DEFAULT '#818CF8',
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            original_name       TEXT,
            extension           TEXT,
            mime_type           TEXT,
            size_bytes          INTEGER DEFAULT 0,
            parent_id           TEXT NOT NULL DEFAULT 'root',
            user_id             TEXT NOT NULL,
            telegram_message_id INTEGER,
            telegram_file_id    TEXT,
            thumbnail_msg_id    INTEGER,
            upload_status       TEXT DEFAULT 'pending',
            share_token         TEXT,
            share_enabled       INTEGER DEFAULT 0,
            created_at          TEXT DEFAULT (datetime('now'))
        )
    """)
    await db.execute("CREATE INDEX IF NOT EXISTS idx_files_user_parent ON files(user_id, parent_id)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id)")
    await db.execute("CREATE INDEX IF NOT EXISTS idx_files_share ON files(share_token)")
    await db.commit()
    print("✅ Database tables ready")


async def init_db():
    await get_db()


async def row_to_dict(row) -> dict:
    if row is None:
        return None
    return dict(row)


async def rows_to_list(rows) -> list:
    if not rows:
        return []
    return [dict(r) for r in rows]