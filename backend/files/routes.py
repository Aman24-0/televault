"""
TeleVault v2 - Files & Folders CRUD
All operations scoped to current user's data only
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.database import get_db, rows_to_list, row_to_dict
from core.security import get_current_user

router = APIRouter()


# ── Folder Models ───────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str
    parent_id: str = "root"
    color: str = "#818CF8"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None


# ── Folder Routes ───────────────────────────────────────────

@router.get("/folders")
async def list_folders(parent_id: str = "root", user=Depends(get_current_user)):
    db = await get_db()
    rows = await (await db.execute(
        "SELECT * FROM folders WHERE user_id=? AND parent_id=? AND is_trashed=0 ORDER BY name",
        (user["user_id"], parent_id)
    )).fetchall()
    return {"folders": await rows_to_list(rows)}


@router.post("/folders")
async def create_folder(body: FolderCreate, user=Depends(get_current_user)):
    db = await get_db()
    fid = secrets.token_urlsafe(12)
    await db.execute(
        "INSERT INTO folders (id,name,parent_id,user_id,color) VALUES (?,?,?,?,?)",
        (fid, body.name.strip(), body.parent_id, user["user_id"], body.color)
    )
    await db.commit()
    row = await (await db.execute("SELECT * FROM folders WHERE id=?", (fid,))).fetchone()
    return await row_to_dict(row)


@router.patch("/folders/{folder_id}")
async def update_folder(folder_id: str, body: FolderUpdate, user=Depends(get_current_user)):
    db = await get_db()
    row = await (await db.execute(
        "SELECT * FROM folders WHERE id=? AND user_id=? AND is_trashed=0", (folder_id, user["user_id"])
    )).fetchone()
    if not row:
        raise HTTPException(404, "Folder not found")

    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        return await row_to_dict(row)

    set_clause = ", ".join(f"{k}=?" for k in updates)
    await db.execute(
        f"UPDATE folders SET {set_clause} WHERE id=? AND user_id=?",
        (*updates.values(), folder_id, user["user_id"])
    )
    await db.commit()
    updated = await (await db.execute("SELECT * FROM folders WHERE id=?", (folder_id,))).fetchone()
    return await row_to_dict(updated)


@router.delete("/folders/{folder_id}")
async def soft_delete_folder(folder_id: str, user=Depends(get_current_user)):
    db = await get_db()
    # Move folder to trash (Soft Delete)
    await db.execute(
        "UPDATE folders SET is_trashed=1 WHERE id=? AND user_id=?", (folder_id, user["user_id"])
    )
    await db.commit()
    return {"deleted": True, "trashed": True}


@router.post("/folders/{folder_id}/restore")
async def restore_folder(folder_id: str, user=Depends(get_current_user)):
    db = await get_db()
    await db.execute(
        "UPDATE folders SET is_trashed=0 WHERE id=? AND user_id=?", (folder_id, user["user_id"])
    )
    await db.commit()
    return {"restored": True}


async def _collect_file_msg_ids(db, folder_id: str, user_id: str) -> list:
    """Recursively collect telegram_message_id from all files in folder tree"""
    msg_ids = []
    files = await (await db.execute(
        "SELECT telegram_message_id, thumbnail_msg_id FROM files WHERE parent_id=? AND user_id=?",
        (folder_id, user_id)
    )).fetchall()
    for f in files:
        if f["telegram_message_id"]: msg_ids.append(f["telegram_message_id"])
        if f["thumbnail_msg_id"]:    msg_ids.append(f["thumbnail_msg_id"])

    subfolders = await (await db.execute(
        "SELECT id FROM folders WHERE parent_id=? AND user_id=?", (folder_id, user_id)
    )).fetchall()
    for sf in subfolders:
        msg_ids.extend(await _collect_file_msg_ids(db, sf["id"], user_id))
    return msg_ids


async def _delete_tg_messages(user_id: str, msg_ids: list):
    try:
        from storage.telegram_ops import delete_messages
        await delete_messages(user_id, msg_ids)
    except Exception as e:
        print(f"Telegram cleanup warning: {e}")


# ── File Models ─────────────────────────────────────────────

class FileUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class ShareToggle(BaseModel):
    enabled: bool


# ── File Routes ─────────────────────────────────────────────

@router.get("/files")
async def list_files(parent_id: str = "root", user=Depends(get_current_user)):
    db = await get_db()
    rows = await (await db.execute(
        """SELECT * FROM files 
           WHERE user_id=? AND parent_id=? AND upload_status='completed' AND is_trashed=0
           ORDER BY created_at DESC""",
        (user["user_id"], parent_id)
    )).fetchall()
    return {"files": await rows_to_list(rows)}


@router.get("/files/search")
async def search_files(q: str, user=Depends(get_current_user)):
    db = await get_db()
    pattern = f"%{q}%"
    files = await (await db.execute(
        "SELECT * FROM files WHERE user_id=? AND upload_status='completed' AND is_trashed=0 AND name LIKE ?",
        (user["user_id"], pattern)
    )).fetchall()
    folders = await (await db.execute(
        "SELECT * FROM folders WHERE user_id=? AND is_trashed=0 AND name LIKE ?",
        (user["user_id"], pattern)
    )).fetchall()
    return {
        "files":   await rows_to_list(files),
        "folders": await rows_to_list(folders)
    }


@router.get("/files/{file_id}")
async def get_file(file_id: str, user=Depends(get_current_user)):
    db = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE id=? AND user_id=? AND is_trashed=0", (file_id, user["user_id"])
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")
    return await row_to_dict(row)


@router.patch("/files/{file_id}")
async def update_file(file_id: str, body: FileUpdate, user=Depends(get_current_user)):
    db = await get_db()
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates: raise HTTPException(400, "Nothing to update")

    set_clause = ", ".join(f"{k}=?" for k in updates)
    result = await db.execute(
        f"UPDATE files SET {set_clause} WHERE id=? AND user_id=? AND is_trashed=0",
        (*updates.values(), file_id, user["user_id"])
    )
    await db.commit()
    if result.rowcount == 0: raise HTTPException(404, "File not found")
    row = await (await db.execute("SELECT * FROM files WHERE id=?", (file_id,))).fetchone()
    return await row_to_dict(row)


@router.delete("/files/{file_id}")
async def soft_delete_file(file_id: str, user=Depends(get_current_user)):
    db = await get_db()
    row = await (await db.execute(
        "SELECT id FROM files WHERE id=? AND user_id=?", (file_id, user["user_id"])
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")

    # Move file to trash (Soft Delete)
    await db.execute("UPDATE files SET is_trashed=1 WHERE id=? AND user_id=?", (file_id, user["user_id"]))
    await db.commit()

    return {"deleted": True, "trashed": True}


@router.post("/files/{file_id}/restore")
async def restore_file(file_id: str, user=Depends(get_current_user)):
    db = await get_db()
    await db.execute("UPDATE files SET is_trashed=0 WHERE id=? AND user_id=?", (file_id, user["user_id"]))
    await db.commit()
    return {"restored": True}


@router.post("/files/{file_id}/share")
async def toggle_share(file_id: str, body: ShareToggle, user=Depends(get_current_user)):
    db = await get_db()
    row = await (await db.execute(
        "SELECT * FROM files WHERE id=? AND user_id=? AND is_trashed=0", (file_id, user["user_id"])
    )).fetchone()
    if not row: raise HTTPException(404, "File not found")
    row = dict(row)

    if body.enabled:
        token = row.get("share_token") or secrets.token_urlsafe(10)
        await db.execute(
            "UPDATE files SET share_enabled=1, share_token=? WHERE id=?",
            (token, file_id)
        )
        row["share_token"] = token
        row["share_enabled"] = 1
    else:
        await db.execute(
            "UPDATE files SET share_enabled=0 WHERE id=?", (file_id,)
        )
        row["share_enabled"] = 0
    await db.commit()
    return row


@router.get("/breadcrumb")
async def breadcrumb(folder_id: str, user=Depends(get_current_user)):
    if folder_id == "root":
        return {"breadcrumb": []}
    db = await get_db()
    crumbs = []
    current = folder_id
    for _ in range(20):
        if current == "root": break
        row = await (await db.execute(
            "SELECT id, name, parent_id FROM folders WHERE id=? AND user_id=?",
            (current, user["user_id"])
        )).fetchone()
        if not row: break
        crumbs.insert(0, {"id": row["id"], "name": row["name"]})
        current = row["parent_id"]
    return {"breadcrumb": crumbs}


# ── Trash Routes (NEW) ────────────────────────────────────────

@router.get("/trash")
async def get_trash(user=Depends(get_current_user)):
    db = await get_db()
    files = await (await db.execute(
        "SELECT * FROM files WHERE user_id=? AND is_trashed=1 ORDER BY created_at DESC", (user["user_id"],)
    )).fetchall()
    folders = await (await db.execute(
        "SELECT * FROM folders WHERE user_id=? AND is_trashed=1 ORDER BY name", (user["user_id"],)
    )).fetchall()
    return {"files": await rows_to_list(files), "folders": await rows_to_list(folders)}


@router.post("/trash/empty")
async def empty_trash(user=Depends(get_current_user)):
    db = await get_db()
    
    # 1. Collect msg_ids for files directly in trash
    trashed_files = await (await db.execute(
        "SELECT telegram_message_id, thumbnail_msg_id FROM files WHERE user_id=? AND is_trashed=1", 
        (user["user_id"],)
    )).fetchall()
    
    # 2. Collect msg_ids for files inside trashed folders recursively
    trashed_folders = await (await db.execute(
        "SELECT id FROM folders WHERE user_id=? AND is_trashed=1", 
        (user["user_id"],)
    )).fetchall()
    
    msg_ids = []
    for f in trashed_files:
        if f["telegram_message_id"]: msg_ids.append(f["telegram_message_id"])
        if f["thumbnail_msg_id"]:    msg_ids.append(f["thumbnail_msg_id"])
        
    for folder in trashed_folders:
        folder_msg_ids = await _collect_file_msg_ids(db, folder["id"], user["user_id"])
        msg_ids.extend(folder_msg_ids)
        # Delete contents of trashed folders
        await db.execute("DELETE FROM files WHERE parent_id=? AND user_id=?", (folder["id"], user["user_id"]))
        await db.execute("DELETE FROM folders WHERE parent_id=? AND user_id=?", (folder["id"], user["user_id"]))

    # 3. Permanently delete trashed items from DB
    await db.execute("DELETE FROM files WHERE user_id=? AND is_trashed=1", (user["user_id"],))
    await db.execute("DELETE FROM folders WHERE user_id=? AND is_trashed=1", (user["user_id"],))
    await db.commit()

    # 4. Trigger Telegram deletion
    if msg_ids:
        import asyncio
        asyncio.create_task(_delete_tg_messages(user["user_id"], msg_ids))

    return {"deleted": True, "files_removed": len(msg_ids)}