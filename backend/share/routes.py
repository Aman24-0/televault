from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from files.firestore import get_file_by_share_token
from storage.telegram import stream_file_from_telegram

router = APIRouter()

@router.get("/{token}/info")
async def share_info(token: str):
    f = get_file_by_share_token(token)
    if not f: raise HTTPException(status_code=404, detail="Link not found or disabled")
    return {"name": f.get("name"), "extension": f.get("extension"),
            "size_bytes": f.get("size_bytes"), "mime_type": f.get("mime_type"), "token": token}

@router.get("/{token}")
async def share_download(token: str):
    f = get_file_by_share_token(token)
    if not f: raise HTTPException(status_code=404, detail="Link not found or disabled")
    return StreamingResponse(
        stream_file_from_telegram(f["telegram_message_id"]),
        media_type=f.get("mime_type","application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{f.get("name","file")}"',
                 "Content-Length": str(f.get("size_bytes",0))}
    )
