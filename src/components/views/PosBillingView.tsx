"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  UserPlus,
  Users,
  UserCheck,
  Tag,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import {
  Customer,
  DiscountType,
  PaymentMethod,
  Product,
  SaleRecord,
} from "@/types/pos";
import { formatINR, round2 } from "@/lib/format";
import { PaymentStatusBadge, StockStatusBadge } from "@/components/StatusBadge";

interface CartItem {
  product: Product;
  quantity: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_reason: string;
  showDiscountEdit?: boolean;
}

interface DraftPaymentRow {
  id: string;
  payment_method: PaymentMethod;
  amount_received: string;
  upi_reference: string;
  notes: string;
  duplicateWarning?: {
    isDuplicate: boolean;
    bills: string[];
  };
}

interface PosBillingProps {
  products: Product[];
  customers: Customer[];
  adminName: string;
  onSaleCompleted: (sale: SaleRecord) => void;
}

export function PosBillingView({
  products,
  customers,
  adminName,
  onSaleCompleted,
}: PosBillingProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer selection mode: 'anonymous' | 'existing' | 'new'
  const [customerMode, setCustomerMode] = useState<
    "anonymous" | "existing" | "new"
  >("anonymous");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    room_number: "",
    phone: "",
  });

  // Bill-level discount state
  const [billDiscountType, setBillDiscountType] =
    useState<DiscountType>("none");
  const [billDiscountValue, setBillDiscountValue] = useState<string>("0");
  const [discountReason, setDiscountReason] = useState<string>("");
  const [discountAuthorizedBy, setDiscountAuthorizedBy] =
    useState<string>(adminName);

  // Manual Payment rows
  const [paymentRows, setPaymentRows] = useState<DraftPaymentRow[]>([
    {
      id: "pay-row-1",
      payment_method: "Cash",
      amount_received: "",
      upi_reference: "",
      notes: "",
    },
  ]);
  const [autoSyncFirstPayment, setAutoSyncFirstPayment] = useState(true);
  const [billNotes, setBillNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => products.filter((p) => p.is_active),
    [products]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    activeProducts.forEach((p) => set.add(p.category));
    return ["ALL", ...Array.from(set)];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeProducts, selectedCategory, searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.room_number && c.room_number.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // Calculate cart totals
  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscountTotal = 0;

    const computedItems = cart.map((item) => {
      const origLine = round2(item.product.selling_price * item.quantity);
      let itemDisc = 0;
      const val = Math.max(0, Number(item.discount_value) || 0);
      if (item.discount_type === "fixed") {
        itemDisc = Math.min(origLine, round2(val));
      } else if (item.discount_type === "percentage") {
        const pct = Math.min(100, val);
        itemDisc = round2((origLine * pct) / 100);
      }
      const finalLine = round2(Math.max(0, origLine - itemDisc));
      subtotal = round2(subtotal + origLine);
      itemDiscountTotal = round2(itemDiscountTotal + itemDisc);
      return {
        ...item,
        origLine,
        itemDisc,
        finalLine,
      };
    });

    const afterItemDiscounts = round2(Math.max(0, subtotal - itemDiscountTotal));
    let billDiscAmount = 0;
    const rawBillVal = Math.max(0, Number(billDiscountValue) || 0);
    if (billDiscountType === "fixed") {
      billDiscAmount = Math.min(afterItemDiscounts, round2(rawBillVal));
    } else if (billDiscountType === "percentage") {
      const pct = Math.min(100, rawBillVal);
      billDiscAmount = round2((afterItemDiscounts * pct) / 100);
    }

    const totalDiscounts = round2(itemDiscountTotal + billDiscAmount);
    const finalPayable = round2(Math.max(0, subtotal - totalDiscounts));

    return {
      computedItems,
      subtotal,
      itemDiscountTotal,
      billDiscAmount,
      totalDiscounts,
      finalPayable,
    };
  }, [cart, billDiscountType, billDiscountValue]);

  // Effective payment amounts
  const effectivePaymentRows = useMemo(() => {
    if (
      autoSyncFirstPayment &&
      paymentRows.length === 1 &&
      calculations.finalPayable > 0
    ) {
      return [
        {
          ...paymentRows[0],
          amount_received: String(calculations.finalPayable),
        },
      ];
    }
    return paymentRows;
  }, [paymentRows, autoSyncFirstPayment, calculations.finalPayable]);

  const totalPaidNow = useMemo(() => {
    return round2(
      effectivePaymentRows.reduce(
        (acc, r) => acc + Math.max(0, Number(r.amount_received) || 0),
        0
      )
    );
  }, [effectivePaymentRows]);

  const remainingDue = useMemo(() => {
    return round2(Math.max(0, calculations.finalPayable - totalPaidNow));
  }, [calculations.finalPayable, totalPaidNow]);

  const resultingPaymentStatus = useMemo(() => {
    if (calculations.finalPayable === 0) return "Paid";
    if (totalPaidNow >= calculations.finalPayable) return "Paid";
    if (totalPaidNow > 0) return "Partially Paid";
    return "Pending";
  }, [calculations.finalPayable, totalPaidNow]);

  // Add product to cart with 1 click
  const handleAddToCart = (product: Product) => {
    setErrorMsg(null);
    if (product.stock_quantity <= 0) {
      setErrorMsg(`"${product.name}" is out of stock (0 available).`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx === -1) {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            discount_type: "none",
            discount_value: 0,
            discount_reason: "",
          },
        ];
      }
      const existing = prev[idx];
      if (existing.quantity + 1 > product.stock_quantity) {
        setErrorMsg(
          `Cannot add more "${product.name}". Only ${product.stock_quantity} available in stock.`
        );
        return prev;
      }
      const updated = [...prev];
      updated[idx] = { ...existing, quantity: existing.quantity + 1 };
      return updated;
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setErrorMsg(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.product.stock_quantity) {
            setErrorMsg(
              `Maximum available stock for "${item.product.name}" is ${item.product.stock_quantity}.`
            );
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleCheckDuplicateUpi = async (rowId: string, upiRef: string) => {
    const trimmed = upiRef.trim();
    if (!trimmed) {
      setPaymentRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, duplicateWarning: undefined } : r
        )
      );
      return;
    }
    try {
      const res = await fetch(
        `/api/payments?checkUpiRef=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = await res.json();
        setPaymentRows((prev) =>
          prev.map((r) =>
            r.id === rowId
              ? {
                  ...r,
                  duplicateWarning: {
                    isDuplicate: Boolean(data.isDuplicate),
                    bills: (data.matchingPayments || []).map(
                      (m: { bill_number: string }) => m.bill_number
                    ),
                  },
                }
              : r
          )
        );
      }
    } catch {
      // ignore network error on live check
    }
  };

  // Payment Quick Presets
  const applyPaymentPreset = (
    preset: "full_cash" | "full_upi" | "split_50_50" | "full_udhaar"
  ) => {
    const total = calculations.finalPayable;
    if (preset === "full_cash") {
      setAutoSyncFirstPayment(true);
      setPaymentRows([
        {
          id: "pay-row-1",
          payment_method: "Cash",
          amount_received: String(total),
          upi_reference: "",
          notes: "",
        },
      ]);
    } else if (preset === "full_upi") {
      setAutoSyncFirstPayment(true);
      setPaymentRows([
        {
          id: "pay-row-1",
          payment_method: "UPI",
          amount_received: String(total),
          upi_reference: "",
          notes: "",
        },
      ]);
    } else if (preset === "split_50_50") {
      setAutoSyncFirstPayment(false);
      const half = Math.floor(total / 2);
      const rest = round2(total - half);
      setPaymentRows([
        {
          id: "pay-row-1",
          payment_method: "Cash",
          amount_received: String(half),
          upi_reference: "",
          notes: "Split Cash",
        },
        {
          id: "pay-row-2",
          payment_method: "UPI",
          amount_received: String(rest),
          upi_reference: "",
          notes: "Split UPI",
        },
      ]);
    } else if (preset === "full_udhaar") {
      setAutoSyncFirstPayment(false);
      setPaymentRows([
        {
          id: "pay-row-1",
          payment_method: "Cash",
          amount_received: "0",
          upi_reference: "",
          notes: "Credit / Udhaar — Unpaid at checkout",
        },
      ]);
      if (customerMode === "anonymous") {
        setCustomerMode("existing");
      }
    }
  };

  const handleCheckout = async () => {
    setErrorMsg(null);
    if (cart.length === 0) {
      setErrorMsg("Please add at least one product to the cart.");
      return;
    }

    if (remainingDue > 0 && customerMode === "anonymous") {
      setErrorMsg(
        `There is an unpaid balance (Udhaar) of ${formatINR(remainingDue)}. Please select an existing customer or enter a new customer's details so their hostel room due can be tracked.`
      );
      return;
    }

    if (customerMode === "existing" && !selectedCustomerId) {
      setErrorMsg("Please select a hostel customer from the dropdown.");
      return;
    }

    if (customerMode === "new" && !newCustomer.name.trim()) {
      setErrorMsg("Please enter the new customer's name.");
      return;
    }

    if (totalPaidNow > calculations.finalPayable + 0.01) {
      setErrorMsg(
        `Total payment entered (${formatINR(totalPaidNow)}) exceeds the final payable amount (${formatINR(calculations.finalPayable)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        idempotency_key: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        customer_id: customerMode === "existing" ? selectedCustomerId : null,
        new_customer:
          customerMode === "new"
            ? {
                name: newCustomer.name.trim(),
                room_number: newCustomer.room_number.trim() || undefined,
                phone: newCustomer.phone.trim() || undefined,
              }
            : null,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
          discount_type: c.discount_type,
          discount_value: Number(c.discount_value) || 0,
          discount_reason: c.discount_reason || undefined,
        })),
        bill_discount_type: billDiscountType,
        bill_discount_value: Number(billDiscountValue) || 0,
        discount_reason: discountReason.trim() || undefined,
        discount_authorized_by: discountAuthorizedBy.trim() || adminName,
        payments: effectivePaymentRows
          .filter((r) => (Number(r.amount_received) || 0) > 0)
          .map((r) => ({
            payment_method: r.payment_method,
            amount_received: Number(r.amount_received) || 0,
            upi_reference: r.upi_reference.trim() || undefined,
            notes: r.notes.trim() || undefined,
          })),
        notes: billNotes.trim() || undefined,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save sale.");
      }

      // Reset POS Cart for next fast transaction
      setCart([]);
      setBillDiscountType("none");
      setBillDiscountValue("0");
      setDiscountReason("");
      setAutoSyncFirstPayment(true);
      setPaymentRows([
        {
          id: "pay-row-1",
          payment_method: "Cash",
          amount_received: "",
          upi_reference: "",
          notes: "",
        },
      ]);
      setBillNotes("");
      if (customerMode === "new") {
        setNewCustomer({ name: "", room_number: "", phone: "" });
        setCustomerMode("anonymous");
      }

      onSaleCompleted(data.sale);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to complete transaction."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
      {/* Left Column: Searchable Product Grid (7 cols on desktop) */}
      <div className="lg:col-span-7 space-y-4">
        <div className="card-3d-static rounded-2xl p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-black text-[#111827]">
                Fast Billing / 3D POS Terminal
              </h1>
              <p className="text-xs text-slate-500">
                Click any snack or cold drink to add to cart immediately
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Kurkure, Maggi, SKU..."
                className="input-3d w-full rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827]"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                  selectedCategory === cat
                    ? "btn-3d-primary"
                    : "btn-3d-secondary text-[#111827]"
                }`}
              >
                {cat === "ALL" ? "All Snacks & Drinks" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full card-3d-static rounded-2xl p-8 text-center text-xs text-slate-500">
              No matching active products found.
            </div>
          ) : (
            filteredProducts.map((product) => {
              const inCartItem = cart.find((c) => c.product.id === product.id);
              const isOutOfStock = product.stock_quantity <= 0;
              const isSelected = Boolean(inCartItem);

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => handleAddToCart(product)}
                  className={`group text-left rounded-2xl p-4 transition flex flex-col justify-between min-h-[138px] ${
                    isOutOfStock
                      ? "bg-slate-100 border border-slate-200 opacity-60 cursor-not-allowed"
                      : isSelected
                        ? "nav-item-3d-active cursor-pointer"
                        : "card-3d cursor-pointer"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                        {product.sku}
                      </span>
                      {inCartItem && (
                        <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-xs">
                          {inCartItem.quantity} in cart
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-extrabold text-[#111827] line-clamp-2 group-hover:text-[#2563EB]">
                      {product.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {product.category}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-base font-black text-[#111827]">
                      {formatINR(product.selling_price)}
                    </span>
                    <StockStatusBadge
                      quantity={product.stock_quantity}
                      minLevel={product.min_stock_level}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Cart, Discounts, Customer & Manual Payment Entry (5 cols on desktop) */}
      <div className="lg:col-span-5 card-3d-static rounded-2xl overflow-hidden sticky top-16">
        {/* Cart Header */}
        <div className="flex items-center justify-between bg-[#090D16] px-5 py-4 text-white border-b-2 border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl orb-3d-blue flex items-center justify-center text-white">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-black">Current Bill Cart</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-xs font-extrabold text-white">
              {cart.reduce((a, b) => a + b.quantity, 0)} Units
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs text-gray-300 hover:text-white underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Cart Line Items */}
          {calculations.computedItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">
              Cart is empty. Tap any product on the left to start billing.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {calculations.computedItems.map((item) => (
                <div key={item.product.id} className="p-3 bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[#111827]">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatINR(item.product.selling_price)} each • Stock:{" "}
                        {item.product.stock_quantity}
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.product.id, -1)}
                        className="h-6 w-6 rounded bg-[#F3F4F6] flex items-center justify-center text-[#111827] hover:bg-gray-200 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-[#111827]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.product.id, 1)}
                        className="h-6 w-6 rounded bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] hover:bg-blue-100 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="ml-1 text-gray-400 hover:text-red-600 cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[60px]">
                      <div className="text-xs font-bold text-[#111827]">
                        {formatINR(item.finalLine)}
                      </div>
                      {item.itemDisc > 0 && (
                        <div className="text-[10px] text-gray-400 line-through">
                          {formatINR(item.origLine)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Item-Level Discount Toggle & Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((c) =>
                            c.product.id === item.product.id
                              ? { ...c, showDiscountEdit: !c.showDiscountEdit }
                              : c
                          )
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                    >
                      <Tag className="h-3 w-3" />
                      {item.itemDisc > 0
                        ? `Item Discount: -${formatINR(item.itemDisc)}`
                        : "Add Item Discount"}
                    </button>
                  </div>

                  {item.showDiscountEdit && (
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-[#F3F4F6] p-2 text-xs">
                      <select
                        value={item.discount_type}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((c) =>
                              c.product.id === item.product.id
                                ? {
                                    ...c,
                                    discount_type: e.target
                                      .value as DiscountType,
                                  }
                                : c
                            )
                          )
                        }
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="none">No Discount</option>
                        <option value="fixed">Fixed (₹)</option>
                        <option value="percentage">Percent (%)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={item.discount_type === "none"}
                        value={item.discount_value}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((c) =>
                              c.product.id === item.product.id
                                ? {
                                    ...c,
                                    discount_value:
                                      parseFloat(e.target.value) || 0,
                                  }
                                : c
                            )
                          )
                        }
                        placeholder="Value"
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        value={item.discount_reason}
                        onChange={(e) =>
                          setCart((prev) =>
                            prev.map((c) =>
                              c.product.id === item.product.id
                                ? { ...c, discount_reason: e.target.value }
                                : c
                            )
                          )
                        }
                        placeholder="Reason (optional)"
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 2. Bill-Level Discount Panel */}
          <div className="rounded-lg border border-gray-200 bg-[#F3F4F6]/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-[#2563EB]" />
                Bill-Level Discount
              </span>
              {calculations.billDiscAmount > 0 && (
                <span className="text-xs font-bold text-[#2563EB]">
                  -{formatINR(calculations.billDiscAmount)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={billDiscountType}
                onChange={(e) =>
                  setBillDiscountType(e.target.value as DiscountType)
                }
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
              >
                <option value="none">No Bill Discount</option>
                <option value="fixed">Fixed Amount Off (₹)</option>
                <option value="percentage">Percentage Off (%)</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                disabled={billDiscountType === "none"}
                value={billDiscountValue}
                onChange={(e) => setBillDiscountValue(e.target.value)}
                placeholder={
                  billDiscountType === "percentage" ? "% off" : "₹ off"
                }
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827] disabled:bg-gray-100"
              />
            </div>

            {(billDiscountType !== "none" ||
              calculations.itemDiscountTotal > 0) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <input
                  type="text"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Discount reason (e.g. Hostel Combo)"
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                />
                <input
                  type="text"
                  value={discountAuthorizedBy}
                  onChange={(e) => setDiscountAuthorizedBy(e.target.value)}
                  placeholder="Authorized by Admin"
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                />
              </div>
            )}
          </div>

          {/* 3. Customer Selection (Anonymous / Existing / New Hostel Student) */}
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2.5">
            <span className="text-xs font-bold text-[#111827] block">
              Customer / Hostel Room Selection
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setCustomerMode("anonymous")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-semibold border transition cursor-pointer ${
                  customerMode === "anonymous"
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "bg-[#F3F4F6] text-[#111827] border-gray-200 hover:bg-gray-200"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Walk-in
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-semibold border transition cursor-pointer ${
                  customerMode === "existing"
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "bg-[#F3F4F6] text-[#111827] border-gray-200 hover:bg-gray-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Existing
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 text-xs font-semibold border transition cursor-pointer ${
                  customerMode === "new"
                    ? "bg-[#2563EB] text-white border-[#2563EB]"
                    : "bg-[#F3F4F6] text-[#111827] border-gray-200 hover:bg-gray-200"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                New Student
              </button>
            </div>

            {customerMode === "existing" && (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Filter by student name or room (e.g. B-204)..."
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-[#111827]"
                />
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
                >
                  <option value="">-- Select Hostel Student --</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{" "}
                      {c.room_number ? `(Room ${c.room_number})` : ""} —{" "}
                      {c.outstanding_dues > 0
                        ? `Due: ${formatINR(c.outstanding_dues)}`
                        : "No Dues"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {customerMode === "new" && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Student Name *"
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-[#111827]"
                />
                <input
                  type="text"
                  value={newCustomer.room_number}
                  onChange={(e) =>
                    setNewCustomer((p) => ({
                      ...p,
                      room_number: e.target.value,
                    }))
                  }
                  placeholder="Room (e.g. B-204)"
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-[#111827]"
                />
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Phone (Optional)"
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-[#111827]"
                />
              </div>
            )}
          </div>

          {/* 4. Manual Payment Entry Section */}
          <div className="rounded-lg border border-blue-200 bg-[#EFF6FF]/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-[#2563EB]" />
                  Manual Payment Entry (No Gateway)
                </span>
                <span className="text-[10px] text-gray-600 block">
                  Record Cash, GPay/PhonePe/Paytm UPI, Split, or Udhaar
                </span>
              </div>
              <PaymentStatusBadge status={resultingPaymentStatus} />
            </div>

            {/* Quick Mode Buttons */}
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => applyPaymentPreset("full_cash")}
                className="rounded bg-white border border-gray-300 py-1 px-1.5 text-[11px] font-semibold text-[#111827] hover:border-[#2563EB] cursor-pointer"
              >
                Full Cash
              </button>
              <button
                type="button"
                onClick={() => applyPaymentPreset("full_upi")}
                className="rounded bg-white border border-gray-300 py-1 px-1.5 text-[11px] font-semibold text-[#2563EB] hover:border-[#2563EB] cursor-pointer"
              >
                Full UPI
              </button>
              <button
                type="button"
                onClick={() => applyPaymentPreset("split_50_50")}
                className="rounded bg-white border border-gray-300 py-1 px-1.5 text-[11px] font-semibold text-[#111827] hover:border-[#2563EB] cursor-pointer"
              >
                Split Pay
              </button>
              <button
                type="button"
                onClick={() => applyPaymentPreset("full_udhaar")}
                className="rounded bg-amber-50 border border-amber-300 py-1 px-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
              >
                Full Udhaar
              </button>
            </div>

            {/* Payment Entry Rows */}
            <div className="space-y-2">
              {effectivePaymentRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="rounded-lg bg-white p-2.5 border border-gray-200 space-y-2"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <label className="text-[10px] font-semibold text-gray-500 block">
                        Method #{idx + 1}
                      </label>
                      <select
                        value={row.payment_method}
                        onChange={(e) => {
                          const method = e.target.value as PaymentMethod;
                          setPaymentRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, payment_method: method }
                                : r
                            )
                          );
                        }}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-[#111827]"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI (Manual Ref)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="col-span-6">
                      <label className="text-[10px] font-semibold text-gray-500 block">
                        Amount Received (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.amount_received}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAutoSyncFirstPayment(false);
                          setPaymentRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, amount_received: val }
                                : r
                            )
                          );
                        }}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-[#111827]"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end pt-3">
                      {paymentRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPaymentRows((prev) =>
                              prev.filter((r) => r.id !== row.id)
                            )
                          }
                          className="text-gray-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual UPI Reference / UTR Input */}
                  {row.payment_method === "UPI" && (
                    <div>
                      <input
                        type="text"
                        value={row.upi_reference}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, upi_reference: val }
                                : r
                            )
                          );
                          handleCheckDuplicateUpi(row.id, val);
                        }}
                        placeholder="Enter 12-digit UPI Ref / UTR manually (optional)"
                        className="w-full rounded border border-blue-300 bg-[#EFF6FF]/40 px-2.5 py-1 text-xs font-mono text-[#111827]"
                      />
                      {row.duplicateWarning?.isDuplicate && (
                        <div className="mt-1.5 rounded bg-amber-50 border border-amber-300 p-2 flex items-start gap-1.5 text-[11px] text-amber-900">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>Duplicate UPI Ref Warning:</strong> This UTR
                            was already entered on Bill{" "}
                            {row.duplicateWarning.bills.join(", ")}. Please
                            verify before saving.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setAutoSyncFirstPayment(false);
                setPaymentRows((prev) => [
                  ...prev,
                  {
                    id: `pay-row-${Date.now()}`,
                    payment_method: "UPI",
                    amount_received: String(remainingDue),
                    upi_reference: "",
                    notes: "",
                  },
                ]);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add Split Payment Entry
            </button>
          </div>

          {/* 5. Bill Summary & Save Button */}
          <div className="rounded-lg bg-[#F3F4F6] p-3.5 space-y-1.5 text-xs border border-gray-200">
            <div className="flex justify-between text-gray-600">
              <span>Original Subtotal:</span>
              <span className="font-semibold text-[#111827]">
                {formatINR(calculations.subtotal)}
              </span>
            </div>
            {calculations.totalDiscounts > 0 && (
              <div className="flex justify-between text-[#2563EB] font-medium">
                <span>Total Discounts (Item + Bill):</span>
                <span>-{formatINR(calculations.totalDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-[#111827] border-t border-gray-300 pt-2">
              <span>Final Payable Amount:</span>
              <span className="text-[#2563EB]">
                {formatINR(calculations.finalPayable)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Amount Received Now:</span>
              <span>{formatINR(totalPaidNow)}</span>
            </div>
            <div className="flex justify-between text-amber-800 font-bold">
              <span>Remaining Due (Udhaar):</span>
              <span>{formatINR(remainingDue)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || cart.length === 0}
            onClick={handleCheckout}
            className="btn-3d-primary w-full rounded-xl py-3.5 px-4 text-sm font-extrabold text-white disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting
              ? "Saving Transaction & Deducting Stock..."
              : `Save Transaction (${formatINR(calculations.finalPayable)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
