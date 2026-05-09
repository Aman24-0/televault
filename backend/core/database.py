"""
TeleVault v2 - SQLite Database
No Firebase. No grpcio. Pure local SQLite.
"""
import aiosqlite
import asyncio
from config import DB_PATH

_db = None

async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA synchronous=NORMAL")
    return _db

async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            phone       TEXT UNIQUE NOT NULL,
            first_name  TEXT,
            tg_user_id  INTEGER UNIQUE,
            session     TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS folders (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            parent_id   TEXT NOT NULL DEFAULT 'root',
            user_id     TEXT NOT NULL,
            color       TEXT DEFAULT '#818CF8',
            is_trashed  INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

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
            is_trashed          INTEGER DEFAULT 0,
            created_at          TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_files_user_parent   ON files(user_id, parent_id);
        CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_id);
        CREATE INDEX IF NOT EXISTS idx_files_share_token   ON files(share_token);
    """)
    
    # Safe migration: Automatically add is_trashed column if it doesn't exist
    try:
        await db.execute("ALTER TABLE files ADD COLUMN is_trashed INTEGER DEFAULT 0")
    except:
        pass # Ignore if column already exists
        
    try:
        await db.execute("ALTER TABLE folders ADD COLUMN is_trashed INTEGER DEFAULT 0")
    except:
        pass # Ignore if column already exists
        
    await db.commit()
    print("✅ Database initialized with Recycle Bin support")

async def row_to_dict(row) -> dict:
    if row is None:
        return None
    return dict(row)

async def rows_to_list(rows) -> list:
    return [dict(r) for r in rows]