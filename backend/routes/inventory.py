from fastapi import APIRouter, HTTPException
from database import supabase

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/")
def get_inventory():
    res = supabase.table("inventory").select("*").order("item_name").execute()
    return res.data

@router.post("/")
def create_inventory_item(body: dict):
    item_name = (body.get("item_name") or "").strip()
    if not item_name:
        raise HTTPException(status_code=400, detail="Item name is required")
    payload = {
        "item_name": item_name,
        "quantity": int(body.get("quantity") or 0),
        "unit": (body.get("unit") or "pcs").strip() or "pcs",
        "price": float(body.get("price") or 0),
    }
    res = supabase.table("inventory").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create inventory item")
    return res.data[0]

@router.patch("/{item_id}")
def update_inventory(item_id: str, body: dict):
    res = supabase.table("inventory").update(body).eq("id", item_id).execute()
    return res.data[0]