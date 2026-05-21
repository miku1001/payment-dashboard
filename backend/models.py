from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class OrderItem(BaseModel):
    name: str
    quantity: str
    price: float

class CreateOrderRequest(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    items: List[OrderItem]
    total_amount: float
    notes: Optional[str] = None

class UpdateStatusRequest(BaseModel):
    status: str
    note: Optional[str] = None