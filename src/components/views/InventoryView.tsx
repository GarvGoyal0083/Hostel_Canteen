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
  Boxes,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Plus,
} from "lucide-react";
import {
  CostCalculationMode,
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
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const [form, setForm] = useState<{
    product_id: string;
    movement_type: StockMovementType;
    quantity: string;
    unit_cost: string;
    cost_calculation_mode: CostCalculationMode;
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
    cost_calculation_mode: "weighted_average",
    reference_id: "",
    reason: "",
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
    setShowAdvancedFields(false);
    setForm({
      product_id: targetProd?.id || "",
      movement_type: defaultType,
      quantity: defaultType === "PURCHASE" ? "12" : "1",
      unit_cost: targetProd ? String(targetProd.purchase_price) : "",
      cost_calculation_mode: "weighted_average",
      reference_id:
        defaultType === "PURCHASE"
          ? `PO-${new Date().toISOString().slice(0, 10)}`
          : `ADJ-${Date.now().toString().slice(-5)}`,
      reason: "",
      supplier_name: targetProd?.supplier_name || "",
      batch_info: targetProd?.batch_info || "",
      expiry_date: targetProd?.expiry_date || "",
    });
    setModalOpen(true);
  };

  const selectedProduct = useMemo(
    () => physicalProducts.find((p) => p.id === form.product_id),
    [physicalProducts, form.product_id]
  );

  const purchaseCalculations = useMemo(() => {
    if (!selectedProduct) return null;

    const currentStock = Math.max(0, selectedProduct.stock_quantity);
    const currentCost = selectedProduct.purchase_price || 0;
    const incomingQty = parseInt(form.quantity, 10) || 0;
    const incomingUnitCost = parseFloat(form.unit_cost) || 0;

    const currentTotalValue = round2(currentStock * currentCost);
    const incomingTotalValue = round2(incomingQty * incomingUnitCost);
    const totalUnitsAfter = currentStock + incomingQty;

    let weightedAvgCost = incomingUnitCost;
    if (totalUnitsAfter > 0 && currentStock > 0 && incomingUnitCost > 0) {
      weightedAvgCost = round2(
        (currentTotalValue + incomingTotalValue) / totalUnitsAfter
      );
    } else if (incomingUnitCost > 0) {
      weightedAvgCost = incomingUnitCost;
    }

    const priceChanged =
      incomingUnitCost > 0 &&
      currentCost > 0 &&
      Math.abs(incomingUnitCost - currentCost) > 0.001;

    const sellingPrice = selectedProduct.selling_price || 0;
    const effectiveCost =
      form.cost_calculation_mode === "latest_cost"
        ? incomingUnitCost
        : form.cost_calculation_mode === "keep_previous"
        ? currentCost
        : weightedAvgCost;

    const estProfitPerUnit = round2(sellingPrice - effectiveCost);
    const profitMarginPercent =
      sellingPrice > 0 ? round2((estProfitPerUnit / sellingPrice) * 100) : 0;

    return {
      currentStock,
      currentCost,
      incomingQty,
      incomingUnitCost,
      currentTotalValue,
      incomingTotalValue,
      totalUnitsAfter,
      weightedAvgCost,
      priceChanged,
      sellingPrice,
      effectiveCost,
      estProfitPerUnit,
      profitMarginPercent,
    };
  }, [selectedProduct, form.quantity, form.unit_cost, form.cost_calculation_mode]);

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

    const finalReason =
      form.reason.trim() ||
      (form.movement_type === "PURCHASE"
        ? form.supplier_name.trim()
          ? `Stock purchase (${form.supplier_name.trim()})`
          : "Incoming wholesale stock purchase"
        : `${form.movement_type} adjustment`);

    // Confirm important stock deductions / adjustments
    if (form.movement_type !== "PURCHASE") {
      const targetProd = products.find((p) => p.id === form.product_id);
      const confirmed = window.confirm(
        `Confirm ${form.movement_type} of ${qty} unit(s) for "${targetProd?.name || "Product"}"?\nReason: ${finalReason}`
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
          cost_calculation_mode: form.cost_calculation_mode,
          reference_id: form.reference_id || undefined,
          reason: finalReason,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
        <div className="inline-flex rounded-lg bg-[#F3F4F6] dark:bg-slate-800 p-1">
          <button
            onClick={() => setActiveSubTab("reconciliation")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              activeSubTab === "reconciliation"
                ? "bg-[#2563EB] text-white"
                : "text-[#111827] dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
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
                : "text-[#111827] dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
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
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-[#111827] dark:text-slate-200"
            />
          </div>

          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-[#111827] dark:text-slate-200"
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
              className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-[#111827] dark:text-slate-200"
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
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-[#F3F4F6] dark:bg-slate-800/80 text-left text-gray-600 dark:text-slate-300">
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
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800 bg-[#F3F4F6] dark:bg-slate-800/80 text-left text-gray-600 dark:text-slate-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-[#F3F4F6] dark:bg-slate-800/80 px-5 py-3.5">
              <div>
                <h3 className="text-base font-bold text-[#111827] dark:text-slate-100 flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-[#2563EB]" />
                  Update Product Quantity & Price
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Quick restock with automatic weighted average price calculation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitMovement}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Fast Mode Selector */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, movement_type: "PURCHASE" }))
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    form.movement_type === "PURCHASE"
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  }`}
                >
                  <PackagePlus className="h-4 w-4" />
                  + Purchase / Restock
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      movement_type:
                        p.movement_type === "PURCHASE" ? "DAMAGED" : p.movement_type,
                    }))
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    form.movement_type !== "PURCHASE"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  - Deduct (Damage / Expiry)
                </button>
              </div>

              {/* Product Selection */}
              <div>
                <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
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
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-[#111827] dark:text-slate-100"
                >
                  {physicalProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Product Snapshot Chip */}
              {selectedProduct && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedProduct.name}
                    </span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      ({selectedProduct.sku})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 dark:text-slate-400">
                      In Stock:{" "}
                      <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                        {selectedProduct.stock_quantity} units
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Current Cost:{" "}
                      <strong className="text-slate-900 dark:text-slate-100 font-extrabold">
                        {formatINR(selectedProduct.purchase_price)}
                      </strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Selling Price:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                        {formatINR(selectedProduct.selling_price)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Purchase Mode Fields */}
              {form.movement_type === "PURCHASE" && (
                <div className="space-y-3.5">
                  {/* Quantity to Add & Quick Chips */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-[#111827] dark:text-slate-100">
                        Quantity to Add (Units) *
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Quick set:</span>
                        {[6, 12, 24, 48, 100].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() =>
                              setForm((p) => ({ ...p, quantity: String(num) }))
                            }
                            className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 cursor-pointer"
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantity: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-extrabold text-[#111827] dark:text-slate-100"
                      placeholder="e.g. 12"
                    />
                  </div>

                  {/* Purchase Cost & Total Invoice Batch Sync */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
                        Purchase Cost per Unit (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={form.unit_cost}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, unit_cost: e.target.value }))
                        }
                        placeholder="e.g. 36.40"
                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[#111827] dark:text-slate-100"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Old recorded cost: {formatINR(selectedProduct?.purchase_price || 0)}
                      </span>
                    </div>

                    <div>
                      <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
                        Total Paid for this Batch (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          purchaseCalculations?.incomingTotalValue
                            ? round2(purchaseCalculations.incomingTotalValue)
                            : ""
                        }
                        onChange={(e) => {
                          const total = parseFloat(e.target.value) || 0;
                          const qty = parseInt(form.quantity, 10) || 1;
                          if (qty > 0) {
                            setForm((p) => ({
                              ...p,
                              unit_cost: String(round2(total / qty)),
                            }));
                          }
                        }}
                        placeholder="e.g. 436.80"
                        className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#111827] dark:text-slate-100 font-mono"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Units × Cost per unit
                      </span>
                    </div>
                  </div>

                  {/* AUTOMATIC WEIGHTED AVERAGE COST CALCULATION CARD */}
                  {purchaseCalculations && (
                    <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          <Calculator className="h-4 w-4 text-[#2563EB]" />
                          Automatic Average Price Calculation
                        </span>
                        {purchaseCalculations.priceChanged ? (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full">
                            Price Changed: {formatINR(purchaseCalculations.currentCost)} → {formatINR(purchaseCalculations.incomingUnitCost)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                            Price Unchanged
                          </span>
                        )}
                      </div>

                      {purchaseCalculations.priceChanged && purchaseCalculations.currentStock > 0 ? (
                        <>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-lg border border-blue-100 dark:border-slate-800">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block">Existing In-Stock:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {purchaseCalculations.currentStock} units @ {formatINR(purchaseCalculations.currentCost)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Subtotal: {formatINR(purchaseCalculations.currentTotalValue)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400 block">New Purchase Batch:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                +{purchaseCalculations.incomingQty} units @ {formatINR(purchaseCalculations.incomingUnitCost)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Subtotal: {formatINR(purchaseCalculations.incomingTotalValue)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
                            <div>
                              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                                New Total Stock:
                              </span>
                              <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                                {purchaseCalculations.totalUnitsAfter} units
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                                Auto-Calculated Weighted Average:
                              </span>
                              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                {formatINR(purchaseCalculations.weightedAvgCost)} / unit
                              </span>
                            </div>
                          </div>

                          {/* Rule Selector */}
                          <div className="space-y-1 pt-0.5">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                              Unit Cost to Save on Product:
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((p) => ({
                                    ...p,
                                    cost_calculation_mode: "weighted_average",
                                  }))
                                }
                                className={`p-2 rounded-lg text-left border transition cursor-pointer text-xs ${
                                  form.cost_calculation_mode === "weighted_average"
                                    ? "border-[#2563EB] bg-blue-100/70 dark:bg-blue-900/40 text-blue-950 dark:text-blue-100 font-bold"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>Weighted Average</span>
                                  <span className="font-black text-emerald-600">
                                    {formatINR(purchaseCalculations.weightedAvgCost)}
                                  </span>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((p) => ({
                                    ...p,
                                    cost_calculation_mode: "latest_cost",
                                  }))
                                }
                                className={`p-2 rounded-lg text-left border transition cursor-pointer text-xs ${
                                  form.cost_calculation_mode === "latest_cost"
                                    ? "border-[#2563EB] bg-blue-100/70 dark:bg-blue-900/40 text-blue-950 dark:text-blue-100 font-bold"
                                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>Latest Purchase Price</span>
                                  <span className="font-bold">
                                    {formatINR(purchaseCalculations.incomingUnitCost)}
                                  </span>
                                </div>
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 py-1">
                          {purchaseCalculations.currentStock === 0 ? (
                            <span>
                              Current stock is 0 units. Product unit purchase price will be set to{" "}
                              <strong className="text-blue-600 dark:text-blue-400 font-bold">
                                {formatINR(purchaseCalculations.incomingUnitCost)}
                              </strong>
                              . Total stock will become <strong>{purchaseCalculations.totalUnitsAfter} units</strong>.
                            </span>
                          ) : (
                            <span>
                              Purchase cost matches existing stock cost (
                              <strong>{formatINR(purchaseCalculations.currentCost)}</strong>
                              ). Total stock will update from {purchaseCalculations.currentStock} to{" "}
                              <strong>{purchaseCalculations.totalUnitsAfter} units</strong>.
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 px-2.5 py-1.5 rounded-lg flex items-center justify-between border border-blue-100 dark:border-slate-800">
                        <span>
                          Selling Price: <strong>{formatINR(purchaseCalculations.sellingPrice)}</strong>
                        </span>
                        <span>
                          Est. Profit per Unit:{" "}
                          <strong
                            className={
                              purchaseCalculations.estProfitPerUnit >= 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-red-600"
                            }
                          >
                            {purchaseCalculations.estProfitPerUnit >= 0 ? "+" : ""}
                            {formatINR(purchaseCalculations.estProfitPerUnit)} (
                            {purchaseCalculations.profitMarginPercent}%)
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Simplified Optional Details Collapsible */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        {showAdvancedFields ? "Hide" : "+ Show"} Optional Details (Supplier, Expiry, Batch, Bill Ref)
                      </span>
                      {showAdvancedFields ? (
                        <ChevronUp className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      )}
                    </button>

                    {showAdvancedFields && (
                      <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
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
                              placeholder="e.g. Zepto / Wholesale Dist"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                              Expiry Date
                            </label>
                            <input
                              type="date"
                              value={form.expiry_date}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  expiry_date: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                              Batch Info
                            </label>
                            <input
                              type="text"
                              value={form.batch_info}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  batch_info: e.target.value,
                                }))
                              }
                              placeholder="e.g. BATCH-OCT26"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                              Bill / PO Reference Note
                            </label>
                            <input
                              type="text"
                              value={form.reference_id}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  reference_id: e.target.value,
                                }))
                              }
                              placeholder="e.g. PO-2026-10-28"
                              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Custom Reason / Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={form.reason}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, reason: e.target.value }))
                            }
                            placeholder="Defaults to 'Incoming wholesale stock purchase'"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deduction / Adjustment Mode Fields */}
              {form.movement_type !== "PURCHASE" && (
                <div className="space-y-3.5">
                  <div>
                    <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
                      Reason for Stock Deduction *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { type: "DAMAGED", label: "Damaged Packets" },
                        { type: "EXPIRED", label: "Expired Stock" },
                        { type: "WASTED", label: "Wasted / Spoilage" },
                        { type: "MISSING", label: "Missing / Theft" },
                        { type: "ADJUSTMENT_SUB", label: "Manual Audit (-)" },
                        { type: "ADJUSTMENT_ADD", label: "Manual Audit (+)" },
                      ].map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              movement_type: t.type as StockMovementType,
                            }))
                          }
                          className={`p-2 rounded-lg text-xs font-semibold border text-center transition cursor-pointer ${
                            form.movement_type === t.type
                              ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200 font-bold"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
                      Quantity to Deduct (Units) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={
                        form.movement_type.includes("ADD")
                          ? undefined
                          : selectedProduct?.stock_quantity || undefined
                      }
                      step="1"
                      required
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, quantity: e.target.value }))
                      }
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold text-[#111827] dark:text-slate-100"
                    />
                    {selectedProduct && !form.movement_type.includes("ADD") && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        Current stock: {selectedProduct.stock_quantity} units &rarr; Remaining:{" "}
                        {Math.max(
                          0,
                          selectedProduct.stock_quantity -
                            (parseInt(form.quantity, 10) || 0)
                        )}{" "}
                        units
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-[#111827] dark:text-slate-100 block mb-1">
                      Reason / Explanation Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.reason}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, reason: e.target.value }))
                      }
                      placeholder="e.g. Found damaged during stock audit"
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-[#111827] dark:text-slate-100"
                    />
                  </div>
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-[#111827] dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-extrabold text-white transition cursor-pointer ${
                    form.movement_type === "PURCHASE"
                      ? "btn-3d-primary"
                      : "bg-rose-600 hover:bg-rose-700 border border-rose-700"
                  } disabled:opacity-50`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting
                    ? "Updating Stock..."
                    : form.movement_type === "PURCHASE"
                    ? `Update Stock (+${form.quantity || 0} Units → Total: ${
                        purchaseCalculations?.totalUnitsAfter || 0
                      })`
                    : `Deduct ${form.quantity || 0} Units`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
