from fastapi import APIRouter, HTTPException
from database import supabase
from models import CreateOrderRequest, UpdateStatusRequest

router = APIRouter(prefix="/orders", tags=["orders"])

VALID_TRANSITIONS = {
    "pending":              "payment_verified",
    "payment_verified":     "inventory_checked",
    "inventory_checked":    "preparing",
    "preparing":            "out_for_delivery",
    "out_for_delivery":     "completed",
}

STATUS_LABELS = {
    "pending":            "Pending Payment",
    "payment_verified":   "Payment Verified",   
    "inventory_checked":  "Inventory Checked",
    "preparing":          "Preparing",
    "out_for_delivery":   "Out for Delivery",
    "completed":          "Completed",
    "cancelled":          "Cancelled",
}

def serialize_order(order: dict) -> dict:
    items = order.get("item") or []
    if "items" not in order:
        order = {**order, "items": items}
    return order

@router.get("/")
def get_orders():
    res = supabase.table("orders").select("*").order("created_at", desc=True).execute()
    return [serialize_order(o) for o in res.data]

@router.get("/{order_id}")
def get_order(order_id: str):
    res = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(res.data)

@router.get("/{order_id}/logs")
def get_order_logs(order_id: str):
    res = supabase.table("order_logs").select("*").eq("order_id", order_id).order("created_at").execute()
    return res.data

@router.post("/")
def create_order(body: CreateOrderRequest):
    items = [item.model_dump() for item in body.items]

    # Validate inventory and reserve stock on order creation.
    for item in items:
        inv = supabase.table("inventory").select("id, quantity").eq("item_name", item["name"]).single().execute()
        if not inv.data:
            raise HTTPException(status_code=400, detail=f"Item not found: {item['name']}")
        available = int(inv.data.get("quantity") or 0)
        requested = int(item.get("quantity") or 0)
        if requested <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid quantity for {item['name']}")
        if available < requested:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item['name']}")

    # Deduct stock (best-effort; no transaction support here).
    updated = []
    for item in items:
        inv = supabase.table("inventory").select("id, quantity").eq("item_name", item["name"]).single().execute()
        new_qty = int(inv.data.get("quantity") or 0) - int(item.get("quantity") or 0)
        res_inv = supabase.table("inventory").update({"quantity": new_qty}).eq("id", inv.data["id"]).execute()
        updated.append({"id": inv.data["id"], "quantity": int(inv.data.get("quantity") or 0), "new_quantity": new_qty})
        if not res_inv.data:
            raise HTTPException(status_code=500, detail=f"Failed to update inventory for {item['name']}")

    try:
        res = supabase.table("orders").insert({
            "customer_name": body.customer_name,
            "customer_email": body.customer_email,
            "item": items,
            "total_amount": body.total_amount,
            "notes": body.notes,
            "status": "pending",
        }).execute()
    except Exception:
        # Attempt rollback if order insert fails.
        for inv in updated:
            supabase.table("inventory").update({"quantity": inv["quantity"]}).eq("id", inv["id"]).execute()
        raise

    order = serialize_order(res.data[0])
    # Log creation
    supabase.table("order_logs").insert({
        "order_id": order["id"],
        "from_status": None,
        "to_status": "pending",
        "note": "Order created",
    }).execute()
    return order

@router.patch("/{order_id}/status")
def update_status(order_id: str, body: UpdateStatusRequest):
    # Get current order
    res = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")

    current = res.data["status"]
    new_status = body.status

    # Allow cancellation from any non-completed status
    if new_status == "cancelled":
        if current == "completed":
            raise HTTPException(status_code=400, detail="Cannot cancel a completed order")
    else:
        # Enforce linear workflow
        allowed_next = VALID_TRANSITIONS.get(current)
        if new_status != allowed_next:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot move from '{STATUS_LABELS[current]}' to '{STATUS_LABELS.get(new_status, new_status)}'. Next step must be '{STATUS_LABELS.get(allowed_next, '—')}'"
            )

    # Update order
    supabase.table("orders").update({"status": new_status}).eq("id", order_id).execute()

    # Log transition
    supabase.table("order_logs").insert({
        "order_id": order_id,
        "from_status": current,
        "to_status": new_status,
        "note": body.note or f"Moved to {STATUS_LABELS.get(new_status, new_status)}",
    }).execute()

    return {"message": "Status updated", "status": new_status}

@router.delete("/{order_id}")
def delete_order(order_id: str):
    supabase.table("orders").delete().eq("id", order_id).execute()
    return {"message": "Order deleted"}