"use client";

import React, { useState, useMemo } from "react";
import {
  PackagePlus,
  History,
  Download,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
} from "lucide-react";
import {
  InventoryMovement,
  Product,
  ProductStockSummary,
  StockMovementType,
  isServiceProduct,
} from "@/types/pos";
import {
  downloadCSV,
  downloadRawCSV,
  escapeCSVCell,
  formatINR,
  formatIST,
  round2,
} from "@/lib/format";
import { StockStatusBadge } from "@/components/StatusBadge";

interface InventoryViewProps {
  products: Product[];
  summaries: ProductStockSummary[];
  movements: InventoryMovement[];
  initialSelectedProductId?: string | null;
  onRefresh: () => void;
}

export function InventoryView({
  products,
  summaries,
  movements,
  initialSelectedProductId,
  onRefresh,
}: InventoryViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"reconciliation" | "history">(
    "reconciliation"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState(
    initialSelectedProductId || "ALL"
  );

  // Stock Update Modal State
  const [modalOpen, setModalOpen] = useState(Boolean(initialSelectedProductId));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<{
    product_id: string;
    movement_type: StockMovementType;
    quantity: string;
    unit_cost: string;
    reference_id: string;
    reason: string;
    supplier_name: string;
    batch_info: string;
    expiry_date: string;
  }>({
    product_id: initialSelectedProductId || products[0]?.id || "",
    movement_type: "PURCHASE",
    quantity: "12",
    unit_cost: "",
    reference_id: "",
    reason: "Wholesale restock purchase",
    supplier_name: "",
    batch_info: "",
    expiry_date: "",
  });

  // Services (like Room Delivery Charge) do not carry physical inventory stock
  const physicalSummaries = useMemo(
    () => summaries.filter((s) => !isServiceProduct(s)),
    [summaries]
  );

  const physicalMovements = useMemo(
    () =>
      movements.filter(
        (m) => !isServiceProduct({ id: m.product_id, sku: m.sku_snapshot })
      ),
    [movements]
  );

  const physicalProducts = useMemo(
    () => products.filter((p) => !isServiceProduct(p)),
    [products]
  );

  const openUpdateStockModal = (
    productId?: string,
    defaultType: StockMovementType = "PURCHASE"
  ) => {
    const targetProd =
      physicalProducts.find((p) => p.id === productId) || physicalProducts[0] || null;
    setErrorMsg(null);
    setForm({
      product_id: targetProd?.id || "",
      movement_type: defaultType,
      quantity: defaultType === "PURCHASE" ? "12" : "1",
      unit_cost: targetProd ? String(targetProd.purchase_price) : "",
      reference_id:
        defaultType === "PURCHASE"
          ? `PO-${new Date().toISOString().slice(0, 10)}`
          : `ADJ-${Date.now().toString().slice(-5)}`,
      reason:
        defaultType === "PURCHASE"
          ? "Incoming wholesale stock purchase"
          : "",
      supplier_name: targetProd?.supplier_name || "",
      batch_info: targetProd?.batch_info || "",
      expiry_date: targetProd?.expiry_date || "",
    });
    setModalOpen(true);
  };

  const totalInventoryCostValue = useMemo(
    () => round2(physicalSummaries.reduce((acc, s) => acc + s.inventory_value, 0)),
    [physicalSummaries]
  );

  const totalClosingUnits = useMemo(
    () => physicalSummaries.reduce((acc, s) => acc + s.closing_stock, 0),
    [physicalSummaries]
  );

  const filteredSummaries = useMemo(() => {
    return physicalSummaries.filter((s) => {
      if (productFilter !== "ALL" && s.product_id !== productFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          s.product_name.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [physicalSummaries, productFilter, searchQuery]);

  const filteredMovements = useMemo(() => {
    return physicalMovements.filter((m) => {
      if (productFilter !== "ALL" && m.product_id !== productFilter) {
        return false;
      }
      if (
        movementTypeFilter !== "ALL" &&
        m.movement_type !== movementTypeFilter
      ) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          m.product_name_snapshot.toLowerCase().includes(q) ||
          m.sku_snapshot.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.reference_id && m.reference_id.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [movements, productFilter, movementTypeFilter, searchQuery]);

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.product_id) {
      setErrorMsg("Please select a product.");
      return;
    }

    const qty = parseInt(form.quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorMsg("Quantity must be a positive whole number.");
      return;
    }

    if (!form.reason.trim()) {
      setErrorMsg("Please provide a reason for this stock update.");
      return;
    }

    // Confirm important stock deductions / adjustments
    if (form.movement_type !== "PURCHASE") {
      const targetProd = products.find((p) => p.id === form.product_id);
      const confirmed = window.confirm(
        `Confirm ${form.movement_type} of ${qty} unit(s) for "${targetProd?.name || "Product"}"?\nReason: ${form.reason}`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: form.product_id,
          movement_type: form.movement_type,
          quantity: qty,
          unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : undefined,
          reference_id: form.reference_id || undefined,
          reason: form.reason,
          supplier_name: form.supplier_name || undefined,
          batch_info: form.batch_info || undefined,
          expiry_date: form.expiry_date || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update stock.");
      }

      setModalOpen(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const timestamp = formatIST(new Date().toISOString());
    if (activeSubTab === "reconciliation") {
      const headers = [
        "SKU",
        "Product",
        "Category",
        "Opening Stock",
        "Purchases (+)",
        "Sales (-)",
        "Damaged/Expired/Wasted (-)",
        "Manual Adjustments (+/-)",
        "Returns Restored (+)",
        "Closing Stock",
        "Min Stock Level",
        "Unit Purchase Cost (INR)",
        "Inventory Cost Value (INR)",
        "Status",
      ];
      const lines: string[] = [
        "HOSTEL CANTEEN - STOCK RECONCILIATION REPORT",
        `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
        `"Total Records Count",${filteredSummaries.length}`,
        "",
        headers.map(escapeCSVCell).join(","),
      ];
      if (filteredSummaries.length > 0) {
        filteredSummaries.forEach((s) => {
          const row = [
            s.sku,
            s.product_name,
            s.category,
            s.opening_stock,
            s.purchases,
            s.sales,
            s.damaged_expired_wasted,
            s.manual_adjustments,
            s.returns_restored,
            s.closing_stock,
            s.min_stock_level,
            s.purchase_price,
            s.inventory_value,
            s.stock_status,
          ];
          lines.push(row.map(escapeCSVCell).join(","));
        });
      } else {
        lines.push(
          headers
            .map((_, i) =>
              i === 0 ? '"No stock reconciliation records found"' : '""'
            )
            .join(",")
        );
      }
      downloadRawCSV(
        "Hostel-Canteen-Stock-Reconciliation.csv",
        lines.join("\r\n")
      );
    } else {
      const headers = [
        "Date & Time (IST)",
        "Product",
        "SKU",
        "Movement Type",
        "Quantity Change",
        "Previous Stock",
        "New Closing Stock",
        "Unit Cost (INR)",
        "Reference",
        "Reason",
        "Supplier",
        "Recorded By",
      ];
      const lines: string[] = [
        "HOSTEL CANTEEN - INVENTORY MOVEMENTS LEDGER REPORT",
        `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
        `"Total Records Count",${filteredMovements.length}`,
        "",
        headers.map(escapeCSVCell).join(","),
      ];
      if (filteredMovements.length > 0) {
        filteredMovements.forEach((m) => {
          const row = [
            formatIST(m.created_at),
            m.product_name_snapshot,
            m.sku_snapshot,
            m.movement_type,
            m.quantity_change,
            m.previous_stock,
            m.new_stock,
            m.unit_cost,
            m.reference_id || "",
            m.reason,
            m.supplier_name || "",
            m.recorded_by,
          ];
          lines.push(row.map(escapeCSVCell).join(","));
        });
      } else {
        lines.push(
          headers
            .map((_, i) =>
              i === 0 ? '"No inventory movements recorded"' : '""'
            )
            .join(",")
        );
      }
      downloadRawCSV(
        "Hostel-Canteen-Inventory-Movements.csv",
        lines.join("\r\n")
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Inventory &amp; Stock Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track opening stock, incoming purchases, automatic sale deductions, damaged/expired items, and closing stock value.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#111827] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button
            onClick={() => openUpdateStockModal(undefined, "DAMAGED")}
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#111827] cursor-pointer"
          >
            Record Damage / Adjustment
          </button>
          <button
            onClick={() => openUpdateStockModal(undefined, "PURCHASE")}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <PackagePlus className="h-4 w-4" />
            Update Stock / Purchase
          </button>
        </div>
      </div>

      {/* Inventory Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Current Inventory Value (Cost)
          </span>
          <span className="text-2xl font-black text-[#111827] mt-1 block">
            {formatINR(totalInventoryCostValue)}
          </span>
          <span className="text-[11px] text-slate-500">
            Based on recorded unit purchase prices
          </span>
        </div>

        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Total Closing Stock Units
          </span>
          <span className="text-2xl font-black text-[#2563EB] mt-1 block">
            {totalClosingUnits} Units
          </span>
          <span className="text-[11px] text-slate-500">
            Across {physicalSummaries.length} products
          </span>
        </div>

        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Low Stock Products
          </span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {physicalSummaries.filter((s) => s.stock_status === "LOW_STOCK").length}
          </span>
          <span className="text-[11px] text-slate-500">
            At or below minimum alert level
          </span>
        </div>

        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Out-of-Stock Products
          </span>
          <span className="text-2xl font-black text-red-600 mt-1 block">
            {physicalSummaries.filter((s) => s.stock_status === "OUT_OF_STOCK").length}
          </span>
          <span className="text-[11px] text-slate-500">
            Blocked from POS sales until restocked
          </span>
        </div>
      </div>

      {/* Sub-navigation & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="inline-flex rounded-lg bg-[#F3F4F6] p-1">
          <button
            onClick={() => setActiveSubTab("reconciliation")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "reconciliation"
                ? "bg-[#2563EB] text-white"
                : "text-[#111827] hover:bg-gray-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Opening & Closing Stock Ledger
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "history"
                ? "bg-[#2563EB] text-white"
                : "text-[#111827] hover:bg-gray-200"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Stock Movement History ({movements.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, reason..."
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-xs text-[#111827]"
            />
          </div>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
          >
            <option value="ALL">All Products</option>
            {physicalProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>

          {activeSubTab === "history" && (
            <select
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            >
              <option value="ALL">All Movement Types</option>
              <option value="OPENING">OPENING</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="SALE">SALE</option>
              <option value="DAMAGED">DAMAGED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="MISSING">MISSING</option>
              <option value="WASTED">WASTED</option>
              <option value="ADJUSTMENT_ADD">ADJUSTMENT_ADD</option>
              <option value="ADJUSTMENT_SUB">ADJUSTMENT_SUB</option>
              <option value="SALE_CANCEL_RESTORE">SALE_CANCEL_RESTORE</option>
              <option value="SALE_REFUND_RESTORE">SALE_REFUND_RESTORE</option>
            </select>
          )}
        </div>
      </div>

      {/* Tab 1: Opening, Purchases, Sales, Adjustments & Closing Stock Table */}
      {activeSubTab === "reconciliation" ? (
        <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold">Product & SKU</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Opening
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-emerald-700">
                    + Purchases
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-[#2563EB]">
                    - Sales
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-red-700">
                    - Damaged/Exp
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    +/- Adj & Returns
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Closing Stock
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Inventory Value
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSummaries.map((s) => (
                  <tr key={s.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#111827]">
                        {s.product_name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {s.sku} • {s.category}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700">
                      {s.opening_stock}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-emerald-700">
                      +{s.purchases}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-[#2563EB]">
                      -{s.sales}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-red-600">
                      -{s.damaged_expired_wasted}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700">
                      {s.manual_adjustments + s.returns_restored >= 0
                        ? `+${s.manual_adjustments + s.returns_restored}`
                        : s.manual_adjustments + s.returns_restored}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StockStatusBadge
                        quantity={s.closing_stock}
                        minLevel={s.min_stock_level}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-[#111827]">
                        {formatINR(s.inventory_value)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        @ {formatINR(s.purchase_price)}/unit
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() =>
                          openUpdateStockModal(s.product_id, "PURCHASE")
                        }
                        className="rounded-md bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
                      >
                        Update Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tab 2: Complete Stock Movement History */
        <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold">Date & Time (IST)</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Movement Type</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Qty Change
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Stock Before &rarr; After
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    Reference & Reason
                  </th>
                  <th className="px-4 py-3 font-semibold">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-gray-500"
                    >
                      No stock movement records found.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatIST(m.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#111827]">
                          {m.product_name_snapshot}
                        </div>
                        <div className="text-[11px] font-mono text-gray-500">
                          {m.sku_snapshot}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                            m.quantity_change > 0
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : m.movement_type === "SALE"
                                ? "bg-[#EFF6FF] text-[#1D4ED8] border-blue-200"
                                : "bg-red-50 text-red-800 border-red-200"
                          }`}
                        >
                          {m.movement_type}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-extrabold ${
                          m.quantity_change > 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {m.quantity_change > 0
                          ? `+${m.quantity_change}`
                          : m.quantity_change}
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">
                        {m.previous_stock} &rarr;{" "}
                        <strong className="text-[#111827]">{m.new_stock}</strong>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#111827]">
                          {m.reason}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {m.reference_id ? `Ref: ${m.reference_id}` : ""}
                          {m.supplier_name ? ` • Supplier: ${m.supplier_name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {m.recorded_by}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Update Stock / Record Purchase / Adjustment Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Update Inventory Stock
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitMovement}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Select Product *
                </label>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const prod = products.find((p) => p.id === pid);
                    setForm((prev) => ({
                      ...prev,
                      product_id: pid,
                      unit_cost: prod ? String(prod.purchase_price) : "",
                      supplier_name: prod?.supplier_name || "",
                      batch_info: prod?.batch_info || "",
                    }));
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                >
                  {physicalProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Stock Movement Type *
                  </label>
                  <select
                    value={form.movement_type}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        movement_type: e.target.value as StockMovementType,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-[#111827]"
                  >
                    <option value="PURCHASE">
                      + Incoming Stock Purchase
                    </option>
                    <option value="ADJUSTMENT_ADD">
                      + Manual Stock Addition (Audit)
                    </option>
                    <option value="DAMAGED">- Damaged Product Deduction</option>
                    <option value="EXPIRED">- Expired Product Deduction</option>
                    <option value="MISSING">- Missing Product Deduction</option>
                    <option value="WASTED">- Wasted Product Deduction</option>
                    <option value="ADJUSTMENT_SUB">
                      - Manual Stock Deduction (Audit)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Quantity (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, quantity: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                  />
                </div>
              </div>

              {form.movement_type === "PURCHASE" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg bg-[#EFF6FF] p-3 border border-blue-200">
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Purchase Cost per Unit (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_cost}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, unit_cost: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={form.supplier_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          supplier_name: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Batch Info
                    </label>
                    <input
                      type="text"
                      value={form.batch_info}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, batch_info: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, expiry_date: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[#111827]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Reason / Explanation *
                </label>
                <input
                  type="text"
                  required
                  value={form.reason}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder="e.g. Purchased 2 cartons from wholesale market / Packet damaged"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Reference / Bill / Batch Note (Optional)
                </label>
                <input
                  type="text"
                  value={form.reference_id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, reference_id: e.target.value }))
                  }
                  placeholder="e.g. PO-2026-105"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Updating Stock..." : "Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
