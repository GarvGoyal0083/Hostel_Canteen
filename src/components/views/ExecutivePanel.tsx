"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  ReceiptText,
  LogOut,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Pencil,
  XCircle,
  Wallet,
} from "lucide-react";
import { AdminUser } from "@/types/pos";
import { formatINR, formatIST } from "@/lib/format";
import { CanteenLogo } from "@/components/CanteenLogo";

type Period = "today" | "week" | "month" | "all";
type ExecTab = "billing" | "my_sales";

interface BillingProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  stock_quantity: number;
  min_stock_level: number;
}

interface BillingCustomer {
  id: string;
  name: string;
  room_number?: string | null;
}

interface MySaleItem {
  product_id: string;
  product_name_snapshot: string;
  quantity: number;
  selling_price_at_sale: number;
  final_line_total: number;
}

interface MySale {
  id: string;
  bill_number: string;
  customer_id?: string | null;
  customer_name_snapshot: string;
  room_number_snapshot?: string | null;
  payable_amount: number;
  payment_status: string;
  sale_status: string;
  notes?: string | null;
  created_at: string;
  items: MySaleItem[];
  can_modify: boolean;
}

interface MySalesResponse {
  summary: { bill_count: number; total_sales: number; my_commission: number };
  sales: MySale[];
}

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ExecutivePanel({
  user,
  onLogout,
}: {
  user: AdminUser;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<ExecTab>("billing");
  const [editingSale, setEditingSale] = useState<MySale | null>(null);

  const NAV: Array<{ id: ExecTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "billing", label: "POS Billing", icon: ShoppingCart },
    { id: "my_sales", label: "My Sales", icon: ReceiptText },
  ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#111827]">
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CanteenLogo className="h-9 w-9" size={36} />
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight">
                Hostel Canteen POS
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Sales Executive</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "my_sales") setEditingSale(null);
                    setTab(item.id);
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    active ? "nav-item-3d-active" : "nav-item-3d text-[#111827]"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-[#2563EB]" : "text-slate-500"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900">{user.full_name}</div>
              <div className="text-[10px] text-slate-500">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="btn-3d-secondary rounded-lg p-2 text-slate-600 hover:text-red-600 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {tab === "billing" ? (
          <ExecutiveBilling
            editingSale={editingSale}
            onDone={() => {
              setEditingSale(null);
              setTab("my_sales");
            }}
            onCancelEdit={() => {
              setEditingSale(null);
              setTab("my_sales");
            }}
          />
        ) : (
          <MySalesPage
            onEdit={(sale) => {
              setEditingSale(sale);
              setTab("billing");
            }}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POS Billing (create a bill / edit an unpaid own bill)
// ---------------------------------------------------------------------------

function ExecutiveBilling({
  editingSale,
  onDone,
  onCancelEdit,
}: {
  editingSale: MySale | null;
  onDone: () => void;
  onCancelEdit: () => void;
}) {
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [customers, setCustomers] = useState<BillingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      if (res.ok) {
        const json = await res.json();
        setProducts(json.products);
        setCustomers(json.customers);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Pre-fill the cart when editing an existing bill
  useEffect(() => {
    if (editingSale) {
      const next: Record<string, number> = {};
      for (const item of editingSale.items) {
        next[item.product_id] = (next[item.product_id] || 0) + item.quantity;
      }
      setCart(next);
      setCustomerId(editingSale.customer_id || "");
      setNotes(editingSale.notes || "");
    } else {
      setCart({});
      setCustomerId("");
      setNotes("");
    }
    setError(null);
    setSuccess(null);
  }, [editingSale]);

  // Stock this bill already holds is available again while editing it
  const heldByEditedBill = useMemo(() => {
    const held: Record<string, number> = {};
    if (editingSale) {
      for (const item of editingSale.items) {
        held[item.product_id] = (held[item.product_id] || 0) + item.quantity;
      }
    }
    return held;
  }, [editingSale]);

  const availableStock = (p: BillingProduct) =>
    p.stock_quantity + (heldByEditedBill[p.id] || 0);

  const categories = useMemo(
    () => ["ALL", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, category]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.room_number && c.room_number.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const product = products.find((p) => p.id === id);
          return product ? { product, quantity } : null;
        })
        .filter((l): l is { product: BillingProduct; quantity: number } => l !== null),
    [cart, products]
  );

  const total = cartLines.reduce(
    (acc, l) => acc + l.product.selling_price * l.quantity,
    0
  );

  const setQty = (p: BillingProduct, qty: number) => {
    const clamped = Math.max(0, Math.min(qty, availableStock(p)));
    setCart((prev) => {
      const next = { ...prev };
      if (clamped <= 0) delete next[p.id];
      else next[p.id] = clamped;
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (cartLines.length === 0) {
      setError("Add at least one item to the bill.");
      return;
    }
    if (!customerId) {
      setError("Please select the student this bill is for.");
      return;
    }
    setSubmitting(true);
    try {
      const items = cartLines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
      }));
      const res = editingSale
        ? await fetch(`/api/billing/${editingSale.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "edit",
              customer_id: customerId,
              items,
              notes,
            }),
          })
        : await fetch("/api/billing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotency_key: idempotencyKey,
              customer_id: customerId,
              items,
              notes,
            }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save bill.");

      if (editingSale) {
        onDone();
      } else {
        setSuccess(
          `Bill ${json.sale.bill_number} created for ${json.sale.customer_name_snapshot} (${formatINR(json.sale.payable_amount)}). It has been added to the student's dues.`
        );
        setCart({});
        setCustomerId("");
        setNotes("");
        setIdempotencyKey(newIdempotencyKey());
        await loadCatalog();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bill.");
      await loadCatalog();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-3d-static rounded-2xl p-12 text-center text-xs font-bold text-slate-500">
        Loading products...
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Product picker */}
      <div className="lg:col-span-2 space-y-3">
        {editingSale && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-semibold text-amber-900 flex items-center justify-between gap-3">
            <span>
              Editing Bill <strong>{editingSale.bill_number}</strong>. Stock and the student&apos;s
              dues are adjusted when you save.
            </span>
            <button
              type="button"
              onClick={onCancelEdit}
              className="btn-3d-secondary rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 cursor-pointer"
            >
              Discard Changes
            </button>
          </div>
        )}
        <div className="card-3d-static rounded-2xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search snacks, drinks, SKU..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  category === c ? "btn-3d-primary" : "btn-3d-secondary text-slate-700"
                }`}
              >
                {c === "ALL" ? "All" : c}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-xs text-slate-500 py-6 text-center">
                No matching products.
              </div>
            )}
            {filteredProducts.map((p) => {
              const available = availableStock(p);
              const inCart = cart[p.id] || 0;
              const out = available <= 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={out || inCart >= available}
                  onClick={() => setQty(p, inCart + 1)}
                  className="card-3d rounded-xl p-3 text-left disabled:opacity-50 cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900 leading-snug">{p.name}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-black text-[#1D4ED8]">
                      {formatINR(p.selling_price)}
                    </span>
                    <span
                      className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 border ${
                        out
                          ? "bg-red-50 border-red-200 text-red-700"
                          : available <= p.min_stock_level
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {out ? "Out of stock" : `${available} in stock`}
                    </span>
                  </div>
                  {inCart > 0 && (
                    <div className="mt-1 text-[10px] font-bold text-blue-700">
                      {inCart} in bill
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart & student */}
      <div className="space-y-3">
        <div className="card-3d-static rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#2563EB]" />
            {editingSale ? `Edit Bill ${editingSale.bill_number}` : "Current Bill"}
          </h2>

          {cartLines.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              Tap a product to add it to the bill.
            </div>
          ) : (
            <div className="space-y-2">
              {cartLines.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-2 text-xs border-b border-slate-100 pb-2"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{product.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {formatINR(product.selling_price)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(product, quantity - 1)}
                      className="btn-3d-secondary rounded-md p-1 cursor-pointer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-bold">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQty(product, quantity + 1)}
                      disabled={quantity >= availableStock(product)}
                      className="btn-3d-secondary rounded-md p-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQty(product, 0)}
                      className="rounded-md p-1 text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-16 text-right font-bold">
                    {formatINR(product.selling_price * quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm font-black text-slate-900 pt-1">
            <span>Total</span>
            <span>{formatINR(total)}</span>
          </div>
        </div>

        <div className="card-3d-static rounded-2xl p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-900">Assign to Student</h3>
          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search student name or room..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
          />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
          >
            <option value="">Select a student...</option>
            {filteredCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.room_number ? ` (Room ${c.room_number})` : ""}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
          />
          <p className="text-[11px] text-slate-500">
            The student pays at the canteen room. An admin marks the bill paid.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 flex gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-3d-primary w-full rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Saving..." : editingSale ? "Save Changes" : "Create Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My Sales (own bills + commission only)
// ---------------------------------------------------------------------------

function MySalesPage({ onEdit }: { onEdit: (sale: MySale) => void }) {
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<MySalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<MySale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/my-sales?period=${period}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${cancelTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: cancelReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to cancel bill.");
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel bill.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: MySale) =>
    s.sale_status === "Cancelled"
      ? "Cancelled"
      : s.payment_status === "Paid"
        ? "Paid"
        : s.payment_status === "Partially Paid"
          ? "Partially Paid"
          : "Unpaid (Udhaar)";

  const statusClass = (label: string) =>
    label === "Paid"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : label === "Cancelled"
        ? "bg-slate-100 border-slate-200 text-slate-600"
        : "bg-amber-50 border-amber-200 text-amber-800";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer ${
              period === p.id ? "btn-3d-primary" : "btn-3d-secondary text-slate-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card-3d-static rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Number of Bills
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {data?.summary.bill_count ?? 0}
          </div>
        </div>
        <div className="card-3d-static rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Sale Amount
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {formatINR(data?.summary.total_sales ?? 0)}
          </div>
        </div>
        <div className="card-3d-static rounded-2xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-[#2563EB]" />
            My Commission
          </div>
          <div className="mt-1 text-2xl font-black text-[#1D4ED8]">
            {formatINR(data?.summary.my_commission ?? 0)}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="card-3d-static rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-900 mb-3">My Bills</h2>
        {loading ? (
          <div className="text-xs font-bold text-slate-500">Loading...</div>
        ) : !data || data.sales.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            No bills in this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Bill</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => {
                  const label = statusLabel(s);
                  return (
                    <tr key={s.id} className="border-b border-slate-50 align-top">
                      <td className="py-2.5 pr-3 font-mono font-bold">{s.bill_number}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatIST(s.created_at)}</td>
                      <td className="py-2.5 pr-3">
                        {s.customer_name_snapshot}
                        {s.room_number_snapshot && (
                          <div className="text-[10px] text-slate-500">
                            Room {s.room_number_snapshot}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {s.items
                          .map((i) => `${i.product_name_snapshot} x${i.quantity}`)
                          .join(", ")}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold">
                        {formatINR(s.payable_amount)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusClass(label)}`}
                        >
                          {label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {s.can_modify && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEdit(s)}
                              className="btn-3d-secondary rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 mr-1.5 cursor-pointer"
                            >
                              <Pencil className="inline h-3 w-3 mr-1" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setCancelTarget(s);
                              }}
                              className="btn-3d-secondary rounded-lg px-2.5 py-1 text-[11px] font-bold text-red-700 cursor-pointer"
                            >
                              <XCircle className="inline h-3 w-3 mr-1" />
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-3d-static rounded-2xl bg-white p-5 w-full max-w-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Cancel Bill {cancelTarget.bill_number}?
            </h3>
            <p className="text-xs text-slate-600">
              Items go back to stock and {formatINR(cancelTarget.payable_amount)} is removed
              from {cancelTarget.customer_name_snapshot}&apos;s dues.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="btn-3d-secondary rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Keep Bill
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                {busy ? "Cancelling..." : "Cancel Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
