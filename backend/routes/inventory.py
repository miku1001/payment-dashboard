from fastapi import APIRouter
from database import supabase

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.get("/")
def get_inventory():
    res = supabase.table("inventory").select("*").order("item_name").execute()
    return res.data

@router.patch("/{item_id}")
def update_inventory(item_id: str, body: dict):
    res = supabase.table("inventory").update(body).eq("id", item_id).execute()
    return res.data[0]