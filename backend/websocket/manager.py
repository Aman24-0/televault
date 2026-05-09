"""
TeleVault v2 - WebSocket Manager
Real-time upload progress
"""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

router = APIRouter()
_connections: Dict[str, WebSocket] = {}

class WSManager:
    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        _connections[user_id] = ws

    def disconnect(self, user_id: str):
        _connections.pop(user_id, None)

    async def send(self, user_id: str, data: dict):
        ws = _connections.get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except:
                self.disconnect(user_id)

ws_manager = WSManager()

@router.websocket("/ws/{user_id}")
async def ws_endpoint(ws: WebSocket, user_id: str):
    await ws_manager.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id)
