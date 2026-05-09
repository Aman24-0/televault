from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db #
# ... other imports

router = APIRouter()

@router.get("/")
async def list_folders(parent_id: str = "root", db: AsyncSession = Depends(get_db)):
    # REMOVE THIS LINE: db = await get_db() 
    # FastAPI now provides 'db' automatically via Depends(get_db)
    
    try:
        # Your existing logic using 'db'
        # res = await db.execute(...)
        pass
    except Exception as e:
        raise HTTPException(500, str(e))