"""
TeleVault — Firebase Firestore REST API Client
No firebase-admin, no grpcio — pure HTTP using httpx + PyJWT
"""

import httpx
import time
import secrets
from datetime import datetime, timezone
from typing import Optional
import jwt  # PyJWT
from config import FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

# ── Token cache ─────────────────────────────────────────────

_token_cache = {"token": None, "expires_at": 0}

def _get_access_token() -> str:
    now = int(time.time())
    if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
        return _token_cache["token"]

    payload = {
        "iss": FIREBASE_CLIENT_EMAIL,
        "sub": FIREBASE_CLIENT_EMAIL,
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
        "scope": "https://www.googleapis.com/auth/datastore",
    }
    signed_jwt = jwt.encode(payload, FIREBASE_PRIVATE_KEY, algorithm="RS256")

    resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
              "assertion": signed_jwt},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["expires_at"] = now + data.get("expires_in", 3600)
    return _token_cache["token"]

def _headers():
    return {"Authorization": f"Bearer {_get_access_token()}",
            "Content-Type": "application/json"}

BASE = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents"

# ── Value converters ────────────────────────────────────────

def _to_fs(value):
    if value is None:                return {"nullValue": None}
    if isinstance(value, bool):      return {"booleanValue": value}
    if isinstance(value, int):       return {"integerValue": str(value)}
    if isinstance(value, float):     return {"doubleValue": value}
    if isinstance(value, str):       return {"stringValue": value}
    if isinstance(value, datetime):
        return {"timestampValue": value.isoformat().replace("+00:00", "Z")}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: _to_fs(v) for k, v in value.items()}}}
    if isinstance(value, list):
        return {"arrayValue": {"values": [_to_fs(v) for v in value]}}
    return {"stringValue": str(value)}

def _from_fs(field):
    if "nullValue"      in field: return None
    if "booleanValue"   in field: return field["booleanValue"]
    if "integerValue"   in field: return int(field["integerValue"])
    if "doubleValue"    in field: return float(field["doubleValue"])
    if "stringValue"    in field: return field["stringValue"]
    if "timestampValue" in field: return field["timestampValue"]
    if "mapValue"       in field:
        return {k: _from_fs(v) for k, v in field["mapValue"].get("fields", {}).items()}
    if "arrayValue"     in field:
        return [_from_fs(v) for v in field["arrayValue"].get("values", [])]
    return None

def _doc_to_dict(doc: dict) -> dict:
    fields = doc.get("fields", {})
    result = {k: _from_fs(v) for k, v in fields.items()}
    result["id"] = doc.get("name", "").split("/")[-1]
    return result

# ── Low-level CRUD ──────────────────────────────────────────

def fs_get(collection: str, doc_id: str) -> Optional[dict]:
    resp = httpx.get(f"{BASE}/{collection}/{doc_id}", headers=_headers(), timeout=10)
    if resp.status_code == 404: return None
    resp.raise_for_status()
    return _doc_to_dict(resp.json())

def fs_create(collection: str, data: dict, doc_id: str = None) -> dict:
    if not doc_id:
        doc_id = secrets.token_urlsafe(16)
    body = {"fields": {k: _to_fs(v) for k, v in data.items()}}
    resp = httpx.patch(f"{BASE}/{collection}/{doc_id}",
                       headers=_headers(), json=body, timeout=10)
    resp.raise_for_status()
    return _doc_to_dict(resp.json())

def fs_update(collection: str, doc_id: str, updates: dict) -> dict:
    mask = "&".join(f"updateMask.fieldPaths={f}" for f in updates.keys())
    body = {"fields": {k: _to_fs(v) for k, v in updates.items()}}
    resp = httpx.patch(f"{BASE}/{collection}/{doc_id}?{mask}",
                       headers=_headers(), json=body, timeout=10)
    resp.raise_for_status()
    return _doc_to_dict(resp.json())

def fs_delete(collection: str, doc_id: str):
    httpx.delete(f"{BASE}/{collection}/{doc_id}", headers=_headers(), timeout=10)

def fs_query(collection: str, filters: list) -> list:
    clauses = [{
        "fieldFilter": {
            "field": {"fieldPath": f["field"]},
            "op": f["op"],
            "value": _to_fs(f["value"]),
        }
    } for f in filters]

    where = ({"compositeFilter": {"op": "AND", "filters": clauses}}
             if len(clauses) > 1 else clauses[0])

    body = {"structuredQuery": {
        "from": [{"collectionId": collection}],
        "where": where,
    }}

    resp = httpx.post(f"{BASE}:runQuery", headers=_headers(), json=body, timeout=15)
    resp.raise_for_status()
    return [_doc_to_dict(item["document"])
            for item in resp.json() if "document" in item]

def now_ts():
    return datetime.now(timezone.utc)

# ── Folders ─────────────────────────────────────────────────

def get_folders(user_id, parent_id):
    return fs_query("folders", [
        {"field": "user_id",   "op": "EQUAL", "value": user_id},
        {"field": "parent_id", "op": "EQUAL", "value": parent_id},
    ])

def create_folder(user_id, name, parent_id, color="#F5A623"):
    return fs_create("folders", {"name": name, "parent_id": parent_id,
                                  "user_id": user_id, "color": color,
                                  "created_at": now_ts()})

def get_folder(folder_id):
    return fs_get("folders", folder_id)

def update_folder(folder_id, user_id, updates):
    doc = fs_get("folders", folder_id)
    if not doc or doc.get("user_id") != user_id: return None
    return fs_update("folders", folder_id, updates)

def delete_folder_recursive(folder_id, user_id):
    files = fs_query("files", [
        {"field": "user_id",   "op": "EQUAL", "value": user_id},
        {"field": "parent_id", "op": "EQUAL", "value": folder_id},
    ])
    ids = []
    for f in files:
        ids.append(f["id"]); fs_delete("files", f["id"])
    for sf in fs_query("folders", [
        {"field": "user_id",   "op": "EQUAL", "value": user_id},
        {"field": "parent_id", "op": "EQUAL", "value": folder_id},
    ]):
        delete_folder_recursive(sf["id"], user_id)
    fs_delete("folders", folder_id)
    return ids

# ── Files ───────────────────────────────────────────────────

def get_files(user_id, parent_id):
    return fs_query("files", [
        {"field": "user_id",   "op": "EQUAL", "value": user_id},
        {"field": "parent_id", "op": "EQUAL", "value": parent_id},
    ])

def get_file(file_id, user_id=None):
    doc = fs_get("files", file_id)
    if not doc: return None
    if user_id and doc.get("user_id") != user_id: return None
    return doc

def create_file_doc(user_id, data):
    doc = {**data, "user_id": user_id, "upload_status": "pending",
           "share_enabled": False, "share_token": None, "created_at": now_ts()}
    return fs_create("files", doc)

def update_file(file_id, user_id, updates):
    doc = fs_get("files", file_id)
    if not doc or doc.get("user_id") != user_id: return None
    return fs_update("files", file_id, updates)

def delete_file_doc(file_id, user_id):
    doc = fs_get("files", file_id)
    if not doc or doc.get("user_id") != user_id: return None
    fs_delete("files", file_id)
    return doc

def get_file_by_share_token(token):
    results = fs_query("files", [
        {"field": "share_token",  "op": "EQUAL", "value": token},
        {"field": "share_enabled","op": "EQUAL", "value": True},
    ])
    return results[0] if results else None

def search_files(user_id, query):
    files   = fs_query("files",   [{"field": "user_id", "op": "EQUAL", "value": user_id},
                                    {"field": "upload_status", "op": "EQUAL", "value": "completed"}])
    folders = fs_query("folders", [{"field": "user_id", "op": "EQUAL", "value": user_id}])
    q = query.lower()
    return {"files":   [f for f in files   if q in f.get("name","").lower()],
            "folders": [f for f in folders if q in f.get("name","").lower()]}

# ── Users ────────────────────────────────────────────────────

def get_user_by_name(display_name):
    r = fs_query("users", [{"field": "display_name", "op": "EQUAL", "value": display_name}])
    return r[0] if r else None

def create_user(data):
    return fs_create("users", {**data, "created_at": now_ts()})

def get_user(user_id):
    return fs_get("users", user_id)

def update_user(user_id, updates):
    return fs_update("users", user_id, updates)