from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import orders, inventory

app = FastAPI(title="Order Fulfillment API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(inventory.router)

@app.get("/")
def root():
    return {"status": "ok", "message": "Order Fulfillment API running"}