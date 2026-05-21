import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STATUS_FLOW = [
  { key: "pending", label: "Pending Payment", icon: "⏳", color: "#6B7280" },
  { key: "payment_verified", label: "Payment Verified", icon: "💳", color: "#0E7490" },
  { key: "inventory_checked", label: "Inventory OK", icon: "📦", color: "#15803D" },
  { key: "preparing", label: "Preparing", icon: "🔧", color: "#B45309" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "🚚", color: "#1D4ED8" },
  { key: "completed", label: "Completed", icon: "✅", color: "#0F766E" },
];

const NEXT_STATUS = {
  pending: "payment_verified",
  payment_verified: "inventory_checked",
  inventory_checked: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "completed",
};

const NEXT_ACTION = {
  pending: "Verify Payment",
  payment_verified: "Check Inventory",
  inventory_checked: "Start Preparing",
  preparing: "Mark Out for Delivery",
  out_for_delivery: "Mark Completed",
};

const STATUS_META = Object.fromEntries(STATUS_FLOW.map((s) => [s.key, s]));

function Badge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: "#6B7280" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px",
      borderRadius: 20, background: meta.color + "22",
      color: meta.color, border: `1px solid ${meta.color}44`,
      whiteSpace: "nowrap"
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function OrderCard({ order, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
      padding: "16px 18px", cursor: "pointer", transition: "box-shadow .15s",
      marginBottom: 10
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-soft)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customer_name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString()}
          </div>
        </div>
        <Badge status={order.status} />
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          {order.items?.length || 0} item{order.items?.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          ₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose, onRefresh }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    fetch(`${API}/orders/${order.id}/logs`)
      .then(r => r.json()).then(setLogs).catch(() => {});
  }, [order.id]);

  async function advance() {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setLoading(true);
    await fetch(`${API}/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, note: note || undefined }),
    });
    setNote("");
    setLoading(false);
    onRefresh();
  }

  async function cancel() {
    setLoading(true);
    await fetch(`${API}/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", note: note || "Cancelled by staff" }),
    });
    setNote("");
    setLoading(false);
    setConfirmCancel(false);
    onRefresh();
  }

  const currentIdx = STATUS_FLOW.findIndex(s => s.key === order.status);
  const nextStatus = NEXT_STATUS[order.status];
  const isDone = order.status === "completed" || order.status === "cancelled";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0006", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 18, width: "100%", maxWidth: "min(96vw,560px)",
        maxHeight: "90vh", overflowY: "auto", padding: 24, border: "1px solid var(--border)",
        boxShadow: "var(--shadow)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{order.customer_name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              #{order.id.slice(0, 8).toUpperCase()} · {order.customer_email || "No email"}
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>

        {/* Progress bar */}
        {order.status !== "cancelled" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {STATUS_FLOW.map((s, i) => (
                <div key={s.key} style={{
                  flex: 1, height: 5, borderRadius: 3,
                  background: i <= currentIdx ? s.color : "var(--border)",
                  transition: "background .3s"
                }} />
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Step {Math.max(currentIdx + 1, 1)} of {STATUS_FLOW.length}
            </div>
          </div>
        )}

        {order.status === "cancelled" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#b91c1c" }}>
            ⚠️ This order has been cancelled.
          </div>
        )}

        {/* Current status */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <Badge status={order.status} />
        </div>

        {/* Items */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "10px 14px", background: "var(--surface-2)", fontSize: 12, fontWeight: 600, color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
            ORDER ITEMS
          </div>
          {order.items?.map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between",
              padding: "9px 14px", borderBottom: i < order.items.length - 1 ? "1px solid var(--border)" : "none",
              fontSize: 14
            }}>
              <span>{item.name} × {item.quantity}</span>
              <span style={{ color: "var(--muted)" }}>₱{(item.price * item.quantity).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--surface-2)", fontWeight: 700, fontSize: 15 }}>
            <span>Total</span>
            <span>₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {order.notes && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
            📝 {order.notes}
          </div>
        )}

        {/* Action */}
        {!isDone && (
          <div style={{ marginBottom: 16 }}>
            <textarea
              placeholder="Add a note (optional)..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              style={{
                width: "100%", borderRadius: 10, border: "1px solid var(--border)",
                padding: "9px 12px", fontSize: 13, resize: "none", boxSizing: "border-box",
                marginBottom: 10, fontFamily: "inherit"
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              {nextStatus && (
                <button onClick={advance} disabled={loading} style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                  background: STATUS_META[nextStatus]?.color || "#333",
                  color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer"
                }}>
                  {loading ? "Updating..." : `→ ${NEXT_ACTION[order.status]}`}
                </button>
              )}
              {!confirmCancel ? (
                <button onClick={() => setConfirmCancel(true)} style={{
                  padding: "11px 16px", borderRadius: 10, border: "1px solid #fca5a5",
                  background: "#fff", color: "#ef4444", fontWeight: 500, fontSize: 13, cursor: "pointer"
                }}>Cancel</button>
              ) : (
                <button onClick={cancel} disabled={loading} style={{
                  padding: "11px 16px", borderRadius: 10, border: "none",
                  background: "#ef4444", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer"
                }}>Confirm Cancel?</button>
              )}
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>ACTIVITY LOG</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map((log, i) => (
                <div key={log.id} style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ color: "#c7c1b8", marginTop: 1 }}>●</span>
                  <div>
                    <span>{log.note}</span>
                    <span style={{ marginLeft: 6, color: "#a8a199" }}>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewOrderModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ name: "", quantity: 1, price: 0 }]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/inventory/`)
      .then(r => r.json())
      .then(setInventory)
      .catch(() => {});
  }, []);

  const total = items.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0);

  function setItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function selectItem(idx, itemName) {
    const chosen = inventory.find((inv) => inv.item_name === itemName);
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      return {
        ...it,
        name: itemName,
        price: chosen?.price ?? it.price,
      };
    }));
  }

  async function submit() {
    if (!name.trim()) return setError("Customer name is required.");
    if (items.some(i => !i.name.trim())) return setError("All items must have a name.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          items: items.map(i => ({ name: i.name, quantity: Number(i.quantity), price: Number(i.price) })),
          total_amount: total,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      onCreated();
    } catch {
      setError("Something went wrong. Check if the backend is running.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0006", zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--surface)", borderRadius: 18, width: "100%", maxWidth: "min(96vw,520px)",
        maxHeight: "90vh", overflowY: "auto", padding: 24, border: "1px solid var(--border)",
        boxShadow: "var(--shadow)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>New Order</div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "9px 13px", marginBottom: 14, fontSize: 13, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <label style={lbl}>Customer Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Juan dela Cruz" style={inp} />

        <label style={lbl}>Email (optional)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" style={inp} />

        <label style={lbl}>Items</label>
        {items.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 90px 110px 28px", gap: 6, marginBottom: 6 }}>
            <select value={item.name} onChange={e => selectItem(i, e.target.value)} style={inp}>
              <option value="">Select item</option>
              {inventory.map((inv) => (
                <option key={inv.id || inv.item_name} value={inv.item_name} disabled={Number(inv.quantity) <= 0}>
                  {inv.item_name}{Number(inv.quantity) <= 0 ? " (out of stock)" : ` (${inv.quantity} in stock)`}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={item.quantity} onChange={e => setItem(i, "quantity", e.target.value)} placeholder="Qty" style={inp} />
            <input type="number" min={0} value={item.price} readOnly placeholder="Price" style={{ ...inp, background: "var(--surface-2)", color: "var(--muted)" }} />
            <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
              disabled={items.length === 1}
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
          </div>
        ))}
        <button onClick={() => setItems(p => [...p, { name: "", quantity: 1, price: 0 }])}
          style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 14 }}>
          + Add item
        </button>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, textAlign: "right" }}>
          Total: ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </div>

        <label style={lbl}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Special instructions..." rows={2}
          style={{ ...inp, resize: "none", fontFamily: "inherit" }} />

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 15,
          cursor: "pointer", marginTop: 6
        }}>
          {loading ? "Creating..." : "Create Order"}
        </button>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 };
const inp = {
  width: "100%", borderRadius: 10, border: "1px solid var(--border)",
  padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
  fontFamily: "inherit", outline: "none", background: "var(--surface)",
  color: "var(--text)"
};

// ─── ADMIN DASHBOARD ────────────────────────────────────────────
function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newQty, setNewQty] = useState(0);
  const [newUnit, setNewUnit] = useState("pcs");
  const [newPrice, setNewPrice] = useState(0);
  const [invSaving, setInvSaving] = useState(false);

  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    setInvError("");
    try {
      const res = await fetch(`${API}/inventory/`);
      const data = await res.json();
      setInventory(data);
    } catch {
      setInvError("Failed to load inventory.");
    }
    setInvLoading(false);
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/orders/`);
    const data = await res.json();
    setOrders(data);
    setLoading(false);
    if (selected) {
      const updated = data.find(o => o.id === selected.id);
      if (updated) setSelected(updated);
    }
    fetchInventory();
  }, [selected?.id, fetchInventory]);

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => { fetchInventory(); }, []);

  async function addInventoryItem() {
    if (!newItemName.trim()) {
      setInvError("Item name is required.");
      return;
    }
    setInvSaving(true);
    setInvError("");
    try {
      const res = await fetch(`${API}/inventory/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: newItemName.trim(),
          quantity: Number(newQty) || 0,
          unit: newUnit.trim() || "pcs",
          price: Number(newPrice) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewItemName("");
      setNewQty(0);
      setNewUnit("pcs");
      setNewPrice(0);
      fetchInventory();
    } catch {
      setInvError("Unable to add item. Check if it already exists.");
    }
    setInvSaving(false);
  }

  const counts = {};
  orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
  const total = orders.length;
  const completed = counts["completed"] || 0;
  const active = total - completed - (counts["cancelled"] || 0);

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  return (
    <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "28px 18px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontWeight: 700, fontSize: 26, margin: 0 }}>Order Fulfillment</h1>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>Staff Dashboard</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Orders", value: total, color: "var(--accent)" },
          { label: "Active", value: active, color: "#B45309" },
          { label: "Completed", value: completed, color: "#0F766E" },
        ].map(s => (
          <div key={s.label} style={{
            background: "var(--surface)", borderRadius: 14, padding: "16px 18px",
            border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)"
          }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Inventory */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1fr) minmax(220px,320px)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>AVAILABLE STOCK</div>
            <button onClick={fetchInventory} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}>Refresh</button>
          </div>
          {invLoading ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading inventory...</div>
          ) : inventory.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>No inventory items.</div>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              {inventory.map((inv) => (
                <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.item_name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>₱{Number(inv.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })} · {inv.unit || "pcs"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{inv.quantity}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>in stock</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {invError && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>{invError}</div>
          )}
        </div>

        <div style={{ background: "var(--surface)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 10 }}>ADD STOCK ITEM</div>
          <label style={lbl}>Item name</label>
          <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="New item name" style={inp} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={lbl}>Quantity</label>
              <input type="number" min={0} value={newQty} onChange={e => setNewQty(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Unit</label>
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="pcs" style={inp} />
            </div>
          </div>
          <label style={lbl}>Price</label>
          <input type="number" min={0} value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" style={inp} />
          <button onClick={addInventoryItem} disabled={invSaving} style={{
            width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14,
            cursor: "pointer"
          }}>
            {invSaving ? "Saving..." : "Add Item"}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>All</FilterBtn>
          {STATUS_FLOW.map(s => (
            <FilterBtn key={s.key} active={filter === s.key} color={s.color} onClick={() => setFilter(s.key)}>
              {s.icon} {s.label} {counts[s.key] ? `(${counts[s.key]})` : ""}
            </FilterBtn>
          ))}
          <FilterBtn active={filter === "cancelled"} color="#ef4444" onClick={() => setFilter("cancelled")}>
            ✕ Cancelled {counts["cancelled"] ? `(${counts["cancelled"]})` : ""}
          </FilterBtn>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer",
          boxShadow: "var(--shadow-soft)"
        }}>+ New Order</button>
      </div>

      {/* Orders list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>No orders found.</div>
      ) : (
        filtered.map(order => (
          <OrderCard key={order.id} order={order} onClick={() => setSelected(order)} />
        ))
      )}

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onRefresh={fetchOrders}
        />
      )}
      {showNew && (
        <NewOrderModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); fetchOrders(); }}
        />
      )}
    </div>
  );
}

function FilterBtn({ active, color = "var(--accent)", onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
      border: active ? `1px solid ${color}` : "1px solid var(--border)",
      background: active ? color + "15" : "var(--surface)",
      color: active ? color : "var(--muted)",
      fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap"
    }}>{children}</button>
  );
}

// ─── CUSTOMER VIEW ───────────────────────────────────────────────
function CustomerView() {
  const [step, setStep] = useState("form");
  const [order, setOrder] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ name: "", quantity: 1, price: 0 }]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/inventory/`)
      .then(r => r.json())
      .then(setInventory)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (inventory.length === 0) return;
    setItems(prev => prev.map((it) => {
      if (!it.name) return it;
      const match = inventory.find((inv) => inv.item_name === it.name);
      if (!match) return it;
      const nextPrice = Number(match.price ?? it.price);
      return nextPrice === it.price ? it : { ...it, price: nextPrice };
    }));
  }, [inventory]);

  const total = items.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0);

  function setItem(idx, field, val) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function selectItem(idx, itemName) {
    const chosen = inventory.find((inv) => inv.item_name === itemName);
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      return {
        ...it,
        name: itemName,
        price: Number(chosen?.price ?? it.price),
      };
    }));
  }

  async function submit() {
    if (!name.trim()) return setError("Please enter your name.");
    if (items.some(i => !i.name.trim())) return setError("Please fill in all item names.");
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          items: items.map(i => ({ name: i.name, quantity: Number(i.quantity), price: Number(i.price) })),
          total_amount: total,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setOrder(data);
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  if (step === "done" && order) {
    return (
      <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", padding: "40px 16px" }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
          padding: "26px", textAlign: "center", boxShadow: "var(--shadow)"
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontWeight: 700, fontSize: 24, margin: "0 0 6px" }}>Order Placed!</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>
            Hi {order.customer_name}, your order has been received.<br />
            Reference: <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, textAlign: "left" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 10 }}>ORDER SUMMARY</div>
            {order.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
                <span>{item.name} × {item.quantity}</span>
                <span>₱{(item.price * item.quantity).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Total</span>
              <span>₱{Number(order.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Current status:</span>
            <Badge status={order.status} />
          </div>
          <button onClick={() => { setStep("form"); setOrder(null); setName(""); setEmail(""); setItems([{ name: "", quantity: 1, price: 0 }]); setNotes(""); }}
            style={{
              padding: "11px 28px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer"
            }}>
            Place Another Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, width: "100%", margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontWeight: 700, fontSize: 28, margin: "0 0 6px" }}>Place an Order</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Fill in your details and items below.</p>
      </div>

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
        padding: "24px", boxShadow: "var(--shadow)"
      }}>
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <label style={lbl}>Your Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Juan dela Cruz" style={inp} />

        <label style={lbl}>Email (optional)</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" style={inp} />

        <label style={lbl}>Items</label>
        {items.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 90px 110px 28px", gap: 6, marginBottom: 6 }}>
            <select value={item.name} onChange={e => selectItem(i, e.target.value)} style={inp}>
              <option value="">Select item</option>
              {inventory.map((inv) => (
                <option key={inv.id || inv.item_name} value={inv.item_name} disabled={Number(inv.quantity) <= 0}>
                  {inv.item_name}{Number(inv.quantity) <= 0 ? " (out of stock)" : ` (${inv.quantity} in stock)`}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={item.quantity} onChange={e => setItem(i, "quantity", e.target.value)} placeholder="Qty" style={inp} />
            <input type="number" min={0} value={item.price} readOnly placeholder="₱ Price" style={{ ...inp, background: "var(--surface-2)", color: "var(--muted)" }} />
            <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
              disabled={items.length === 1}
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
          </div>
        ))}
        <button onClick={() => setItems(p => [...p, { name: "", quantity: 1, price: 0 }])}
          style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 14 }}>
          + Add item
        </button>

        <div style={{ textAlign: "right", fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
          Total: ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </div>

        <label style={lbl}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Special instructions..." rows={2}
          style={{ ...inp, resize: "none", fontFamily: "inherit" }} />

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
          background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 15,
          cursor: "pointer", marginTop: 4
        }}>
          {loading ? "Placing Order..." : "Place Order →"}
        </button>
      </div>
    </div>
  );
}

// ─── ROOT APP ───────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState("customer");

  return (
    <div style={{ minHeight: "100svh", background: "transparent", fontFamily: "var(--sans)" }}>
      {/* Top nav */}
      <div style={{
        background: "rgba(255, 255, 255, 0.88)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 10,
        backdropFilter: "blur(10px)"
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.2 }}>📦 FulfillPH</div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: 10, padding: 4, border: "1px solid var(--border)" }}>
          {["customer", "admin"].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: role === r ? "var(--surface)" : "transparent",
              color: role === r ? "var(--accent)" : "var(--muted)",
              fontWeight: role === r ? 600 : 500,
              fontSize: 13,
              boxShadow: role === r ? "var(--shadow-soft)" : "none",
              transition: "all .15s"
            }}>
              {r === "customer" ? "🛒 Customer" : "⚙️ Staff"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {role === "admin" ? <AdminDashboard /> : <CustomerView />}
    </div>
  );
}