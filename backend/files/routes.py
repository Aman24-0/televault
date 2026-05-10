"""
TeleVault v2 - Files & Folders Routes (PostgreSQL version)
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from core.database import get_db, rows_to_list, row_to_dict
from core.security import get_current_user

router = APIRouter()

class FolderCreate(BaseModel):
    name: str
    parent_id: str = "root"
    color: str = "#818CF8"

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None
    color: Optional[str] = None

class FileUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[str] = None

class ShareToggle(BaseModel):
    enabled: bool


# ── Folders ─────────────────────────────────────────────────

@router.get("/folders")
async def list_folders(parent_id: str = "root", user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        rows = await db.fetch(
            "SELECT * FROM folders WHERE user_id=$1 AND parent_id=$2 ORDER BY name",
            user["user_id"], parent_id
        )
    return {"folders": await rows_to_list(rows)}


@router.post("/folders")
async def create_folder(body: FolderCreate, user=Depends(get_current_user)):
    pool = await get_db()
    fid  = secrets.token_urlsafe(12)
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "INSERT INTO folders (id,name,parent_id,user_id,color) VALUES ($1,$2,$3,$4,$5) RETURNING *",
            fid, body.name.strip(), body.parent_id, user["user_id"], body.color
        )
    return await row_to_dict(row)


@router.patch("/folders/{folder_id}")
async def update_folder(folder_id: str, body: FolderUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    pool = await get_db()
    async with pool.acquire() as db:
        set_parts = [f"{k}=${i+3}" for i, k in enumerate(updates.keys())]
        query = f"UPDATE folders SET {', '.join(set_parts)} WHERE id=$1 AND user_id=$2 RETURNING *"
        row = await db.fetchrow(query, folder_id, user["user_id"], *updates.values())
    if not row:
        raise HTTPException(404, "Folder not found")
    return await row_to_dict(row)


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, permanent: bool = False, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        # Check current status
        row = await db.fetchrow("SELECT parent_id FROM folders WHERE id=$1 AND user_id=$2", folder_id, user["user_id"])
        if not row: 
            raise HTTPException(404, "Folder not found")

        # Agar folder pehle se trash me hai ya frontend ne strictly permanent delete bola hai
        if row["parent_id"] == "trash" or permanent:
            files = await db.fetch(
                "SELECT telegram_message_id, thumbnail_msg_id FROM files WHERE parent_id=$1 AND user_id=$2",
                folder_id, user["user_id"]
            )
            msg_ids = []
            for f in files:
                if f["telegram_message_id"]: msg_ids.append(f["telegram_message_id"])
                if f["thumbnail_msg_id"]:    msg_ids.append(f["thumbnail_msg_id"])

            await db.execute("DELETE FROM folders WHERE id=$1 AND user_id=$2", folder_id, user["user_id"])
            
            if msg_ids:
                import asyncio
                asyncio.create_task(_delete_tg(user["user_id"], msg_ids))
                
            return {"deleted": True, "files_removed": len(files), "type": "hard"}
        else:
            # Soft Delete -> Move to Trash
            await db.execute("UPDATE folders SET parent_id='trash' WHERE id=$1 AND user_id=$2", folder_id, user["user_id"])
            return {"deleted": True, "type": "soft"}


# ── Files ────────────────────────────────────────────────────

@router.get("/files")
async def list_files(parent_id: str = "root", user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        rows = await db.fetch(
            "SELECT * FROM files WHERE user_id=$1 AND parent_id=$2 AND upload_status='completed' ORDER BY created_at DESC",
            user["user_id"], parent_id
        )
    return {"files": await rows_to_list(rows)}


@router.get("/files/search")
async def search_files(q: str, user=Depends(get_current_user)):
    pool = await get_db()
    pattern = f"%{q}%"
    async with pool.acquire() as db:
        # Trash files ko search results se exclude kar diya gaya hai
        files   = await db.fetch(
            "SELECT * FROM files WHERE user_id=$1 AND upload_status='completed' AND name ILIKE $2 AND parent_id != 'trash'",
            user["user_id"], pattern
        )
        folders = await db.fetch(
            "SELECT * FROM folders WHERE user_id=$1 AND name ILIKE $2 AND parent_id != 'trash'",
            user["user_id"], pattern
        )
    return {"files": await rows_to_list(files), "folders": await rows_to_list(folders)}


@router.get("/files/{file_id}")
async def get_file(file_id: str, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "SELECT * FROM files WHERE id=$1 AND user_id=$2", file_id, user["user_id"]
        )
    if not row: raise HTTPException(404, "File not found")
    return await row_to_dict(row)


@router.patch("/files/{file_id}")
async def update_file(file_id: str, body: FileUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates: raise HTTPException(400, "Nothing to update")
    pool = await get_db()
    async with pool.acquire() as db:
        set_parts = [f"{k}=${i+3}" for i, k in enumerate(updates.keys())]
        query = f"UPDATE files SET {', '.join(set_parts)} WHERE id=$1 AND user_id=$2 RETURNING *"
        row = await db.fetchrow(query, file_id, user["user_id"], *updates.values())
    if not row: raise HTTPException(404, "File not found")
    return await row_to_dict(row)


@router.delete("/files/{file_id}")
async def delete_file(file_id: str, permanent: bool = False, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "SELECT parent_id, telegram_message_id, thumbnail_msg_id FROM files WHERE id=$1 AND user_id=$2",
            file_id, user["user_id"]
        )
        if not row: raise HTTPException(404, "File not found")

        # Agar file pehle se trash me hai ya strictly permanent delete bola gaya hai
        if row["parent_id"] == "trash" or permanent:
            await db.execute("DELETE FROM files WHERE id=$1 AND user_id=$2", file_id, user["user_id"])
            msg_ids = [x for x in [row["telegram_message_id"], row["thumbnail_msg_id"]] if x]
            if msg_ids:
                import asyncio
                asyncio.create_task(_delete_tg(user["user_id"], msg_ids))
            return {"deleted": True, "type": "hard"}
        else:
            # Soft Delete -> Move to Trash
            await db.execute("UPDATE files SET parent_id='trash' WHERE id=$1 AND user_id=$2", file_id, user["user_id"])
            return {"deleted": True, "type": "soft"}


@router.post("/files/{file_id}/share")
async def toggle_share(file_id: str, body: ShareToggle, user=Depends(get_current_user)):
    pool = await get_db()
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "SELECT * FROM files WHERE id=$1 AND user_id=$2", file_id, user["user_id"]
        )
        if not row: raise HTTPException(404, "File not found")
        row = dict(row)
        if body.enabled:
            token = row.get("share_token") or secrets.token_urlsafe(10)
            await db.execute(
                "UPDATE files SET share_enabled=1, share_token=$1 WHERE id=$2",
                token, file_id
            )
            row["share_token"] = token
            row["share_enabled"] = 1
        else:
            await db.execute("UPDATE files SET share_enabled=0 WHERE id=$1", file_id)
            row["share_enabled"] = 0
    return row


@router.get("/breadcrumb")
async def breadcrumb(folder_id: str, user=Depends(get_current_user)):
    if folder_id in ["root", "trash"]:
        return {"breadcrumb": []}
    pool = await get_db()
    crumbs = []
    current = folder_id
    async with pool.acquire() as db:
        for _ in range(20):
            if current == "root": break
            row = await db.fetchrow(
                "SELECT id, name, parent_id FROM folders WHERE id=$1 AND user_id=$2",
                current, user["user_id"]
            )
            if not row: break
            crumbs.insert(0, {"id": row["id"], "name": row["name"]})
            current = row["parent_id"]
    return {"breadcrumb": crumbs}


@router.get("/trash")
async def get_trash(user=Depends(get_current_user)):
    # Trash route me sirf un files/folders ko lana jinka parent_id 'trash' hai
    pool = await get_db()
    async with pool.acquire() as db:
        files = await db.fetch("SELECT * FROM files WHERE user_id=$1 AND parent_id='trash' ORDER BY created_at DESC", user["user_id"])
        folders = await db.fetch("SELECT * FROM folders WHERE user_id=$1 AND parent_id='trash' ORDER BY name", user["user_id"])
    return {"files": await rows_to_list(files), "folders": await rows_to_list(folders)}


@router.delete("/trash")
async def empty_trash(user=Depends(get_current_user)):
    # Empty trash ka logic
    pool = await get_db()
    async with pool.acquire() as db:
        files = await db.fetch("SELECT telegram_message_id, thumbnail_msg_id FROM files WHERE user_id=$1 AND parent_id='trash'", user["user_id"])
        msg_ids = []
        for f in files:
            if f["telegram_message_id"]: msg_ids.append(f["telegram_message_id"])
            if f["thumbnail_msg_id"]:    msg_ids.append(f["thumbnail_msg_id"])

        await db.execute("DELETE FROM files WHERE user_id=$1 AND parent_id='trash'", user["user_id"])
        await db.execute("DELETE FROM folders WHERE user_id=$1 AND parent_id='trash'", user["user_id"])

        if msg_ids:
            import asyncio
            asyncio.create_task(_delete_tg(user["user_id"], msg_ids))

    return {"deleted": len(files)}


async def _delete_tg(user_id: str, msg_ids: list):
    try:
        from storage.telegram_ops import delete_messages
        await delete_messages(user_id, msg_ids)
    except Exception as e:
        print(f"Telegram cleanup warning: {e}")