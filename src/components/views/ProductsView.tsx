"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Edit3,
  Power,
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  ImageIcon,
} from "lucide-react";
import { Product, isServiceProduct } from "@/types/pos";
import {
  downloadCSV,
  downloadRawCSV,
  escapeCSVCell,
  formatDateIST,
  formatINR,
  formatIST,
  round2,
} from "@/lib/format";
import { StockStatusBadge } from "@/components/StatusBadge";

const DEFAULT_CATEGORIES = [
  "Chips & Namkeen",
  "Biscuits & Cookies",
  "Cold Drinks & Beverages",
  "Instant Noodles & Snacks",
  "Chocolates & Candies",
  "Dairy & Bakery",
  "Stationery & Essentials",
];

const PRESET_PRODUCT_IMAGES = [
  { name: "Kurkure", url: "/products/kurkure.jpg" },
  { name: "Lay's Magic", url: "/products/lays-magic.jpg" },
  { name: "Lay's Cream", url: "/products/lays-cream.jpg" },
  { name: "Haldiram Bhujia", url: "/products/haldiram-bhujia.jpg" },
  { name: "Thums Up", url: "/products/thums-up.jpg" },
  { name: "Coca-Cola", url: "/products/coca-cola.jpg" },
  { name: "Sting Energy", url: "/products/sting.jpg" },
  { name: "Cadbury Oreo", url: "/products/oreo.jpg" },
  { name: "Parle-G Gold", url: "/products/parle-g.jpg" },
  { name: "Good Day", url: "/products/good-day.jpg" },
  { name: "Maggi Noodles", url: "/products/maggi.jpg" },
  { name: "KitKat", url: "/products/kitkat.jpg" },
];

interface ProductsViewProps {
  products: Product[];
  onRefresh: () => void;
  onNavigateToInventory: (productId: string) => void;
}

export function ProductsView({
  products,
  onRefresh,
  onNavigateToInventory,
}: ProductsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showInactive, setShowInactive] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "Chips & Namkeen",
    image_url: "",
    purchase_price: "15",
    selling_price: "20",
    stock_quantity: "20",
    min_stock_level: "10",
    supplier_name: "",
    expiry_date: "",
    batch_info: "",
  });

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    products.forEach((p) => set.add(p.category));
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, showInactive, categoryFilter, searchQuery]);

  const previewUnitProfit = useMemo(() => {
    const buy = parseFloat(form.purchase_price) || 0;
    const sell = parseFloat(form.selling_price) || 0;
    return round2(sell - buy);
  }, [form.purchase_price, form.selling_price]);

  const openAddModal = () => {
    setEditingProduct(null);
    setErrorMsg(null);
    setForm({
      name: "",
      sku: `SNK-${Math.floor(100 + Math.random() * 900)}`,
      category: "Chips & Namkeen",
      image_url: "",
      purchase_price: "16",
      selling_price: "20",
      stock_quantity: "24",
      min_stock_level: "8",
      supplier_name: "",
      expiry_date: "",
      batch_info: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setErrorMsg(null);
    setForm({
      name: prod.name,
      sku: prod.sku,
      category: prod.category,
      image_url: prod.image_url || "",
      purchase_price: String(prod.purchase_price),
      selling_price: String(prod.selling_price),
      stock_quantity: String(prod.stock_quantity),
      min_stock_level: String(prod.min_stock_level),
      supplier_name: prod.supplier_name || "",
      expiry_date: prod.expiry_date || "",
      batch_info: prod.batch_info || "",
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            sku: form.sku,
            category: form.category,
            image_url: form.image_url || null,
            purchase_price: parseFloat(form.purchase_price),
            selling_price: parseFloat(form.selling_price),
            min_stock_level: parseInt(form.min_stock_level, 10),
            supplier_name: form.supplier_name || null,
            expiry_date: form.expiry_date || null,
            batch_info: form.batch_info || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update product.");
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            sku: form.sku,
            category: form.category,
            image_url: form.image_url || undefined,
            purchase_price: parseFloat(form.purchase_price),
            selling_price: parseFloat(form.selling_price),
            stock_quantity: parseInt(form.stock_quantity, 10) || 0,
            min_stock_level: parseInt(form.min_stock_level, 10) || 5,
            supplier_name: form.supplier_name || undefined,
            expiry_date: form.expiry_date || undefined,
            batch_info: form.batch_info || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create product.");
      }

      setModalOpen(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (prod: Product) => {
    const actionLabel = prod.is_active ? "deactivate" : "activate";
    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} "${prod.name}" (${prod.sku})?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !prod.is_active }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  const handleExportCSV = () => {
    const timestamp = formatIST(new Date().toISOString());
    const headers = [
      "SKU",
      "Product Name",
      "Category",
      "Purchase Price (INR)",
      "Selling Price (INR)",
      "Estimated Unit Profit (INR)",
      "Available Stock",
      "Min Alert Level",
      "Inventory Cost Value (INR)",
      "Supplier",
      "Expiry Date",
      "Batch Info",
      "Status",
      "Created At (IST)",
      "Updated At (IST)",
    ];

    const lines: string[] = [
      "HOSTEL CANTEEN - PRODUCTS & INVENTORY CATALOG REPORT",
      `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
      `"Total Records Count",${filteredProducts.length}`,
      "",
      headers.map(escapeCSVCell).join(","),
    ];

    if (filteredProducts.length > 0) {
      filteredProducts.forEach((p) => {
        const row = [
          p.sku,
          p.name,
          p.category,
          p.purchase_price,
          p.selling_price,
          p.estimated_unit_profit,
          p.stock_quantity,
          p.min_stock_level,
          round2(p.stock_quantity * p.purchase_price),
          p.supplier_name || "",
          p.expiry_date || "",
          p.batch_info || "",
          p.is_active ? "Active" : "Deactivated",
          formatIST(p.created_at),
          formatIST(p.updated_at),
        ];
        lines.push(row.map(escapeCSVCell).join(","));
      });
    } else {
      lines.push(
        headers
          .map((_, i) => (i === 0 ? '"No product records found"' : '""'))
          .join(",")
      );
    }

    downloadRawCSV("Hostel-Canteen-Products.csv", lines.join("\r\n"));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Product Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage snacks, chips, biscuits, cold drinks, SKUs, purchase costs, selling prices, and unit profit margins.
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
            onClick={openAddModal}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-3d-static flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU, category, supplier..."
              className="input-3d w-full rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-3d rounded-xl px-3 py-2 text-xs font-bold text-[#111827]"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "ALL" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-[#2563EB]"
          />
          Show deactivated products
        </label>
      </div>

      {/* Products Table */}
      <div className="card-3d-static rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Product &amp; SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">
                  Purchase Cost
                </th>
                <th className="px-4 py-3 text-right">
                  Selling Price
                </th>
                <th className="px-4 py-3 text-right">
                  Est. Unit Profit
                </th>
                <th className="px-4 py-3 text-center">
                  Available Stock
                </th>
                <th className="px-4 py-3">
                  Supplier / Expiry / Batch
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-gray-500"
                  >
                    No products match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50 ${
                      !p.is_active ? "opacity-60 bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden p-1 shadow-2xs">
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400 stroke-[1.5]" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-[#111827] flex items-center gap-1.5">
                            {p.name}
                            {!p.is_active && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                                Deactivated
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-[#2563EB] mt-0.5">
                            {p.sku}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {p.category}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {formatINR(p.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#111827]">
                      {formatINR(p.selling_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-bold ${
                          p.estimated_unit_profit >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {p.estimated_unit_profit >= 0 ? "+" : ""}
                        {formatINR(p.estimated_unit_profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isServiceProduct(p) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 shadow-2xs">
                          Service (No Stock)
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <StockStatusBadge
                            quantity={p.stock_quantity}
                            minLevel={p.min_stock_level}
                          />
                          <span className="text-[10px] text-gray-500">
                            Min Alert: {p.min_stock_level}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-600">
                      <div>{p.supplier_name || "—"}</div>
                      {p.expiry_date && (
                        <div>Exp: {formatDateIST(p.expiry_date)}</div>
                      )}
                      {p.batch_info && <div>Batch: {p.batch_info}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {!isServiceProduct(p) && (
                          <button
                            onClick={() => onNavigateToInventory(p.id)}
                            className="rounded-md bg-[#EFF6FF] dark:bg-blue-950/60 border border-transparent dark:border-blue-800 px-2.5 py-1 text-xs font-semibold text-[#2563EB] dark:text-blue-300 hover:bg-blue-100 transition cursor-pointer"
                          >
                            Update Stock
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                          title="Edit product"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`rounded-md border p-1.5 transition cursor-pointer ${
                            p.is_active
                              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                          title={
                            p.is_active
                              ? "Deactivate product"
                              : "Activate product"
                          }
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                {editingProduct
                  ? `Edit Product — ${editingProduct.sku}`
                  : "Add New Canteen Product"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-[#111827] block mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Kurkure Masala Munch (90g)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Unique SKU / Product Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        sku: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. SNK-KRK-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    list="canteen-categories"
                    required
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                  <datalist id="canteen-categories">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* Product Image & Quick Presets */}
                <div className="sm:col-span-2 space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[#111827] flex items-center gap-1.5 text-xs">
                      <ImageIcon className="h-4 w-4 text-[#2563EB]" />
                      <span>Product Image (Local Path or Online URL)</span>
                    </label>
                    {form.image_url && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, image_url: "" }))}
                        className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        Clear Image
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden p-1 shadow-inner">
                      {form.image_url ? (
                        <img
                          src={form.image_url}
                          alt="Preview"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="h-6 w-6 text-slate-400 stroke-[1.5]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={form.image_url}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, image_url: e.target.value }))
                        }
                        placeholder="e.g. /products/kurkure.jpg or https://image-url..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Selector */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block mb-1.5">
                      Select Online Preset Image:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                      {PRESET_PRODUCT_IMAGES.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() =>
                            setForm((p) => ({ ...p, image_url: preset.url }))
                          }
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            form.image_url === preset.url
                              ? "bg-blue-100 border-blue-400 text-blue-800 shadow-2xs"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="h-3.5 w-3.5 object-contain"
                          />
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Purchase Price per Unit (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.purchase_price}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        purchase_price: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Selling Price per Unit (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, selling_price: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div className="sm:col-span-2 rounded-lg bg-[#EFF6FF] p-3 border border-blue-200 flex items-center justify-between">
                  <span className="font-semibold text-[#111827]">
                    Auto-Calculated Estimated Profit per Unit:
                  </span>
                  <span
                    className={`text-sm font-extrabold ${
                      previewUnitProfit >= 0
                        ? "text-[#2563EB]"
                        : "text-red-600"
                    }`}
                  >
                    {formatINR(previewUnitProfit)} / unit
                  </span>
                </div>

                {!editingProduct && (
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Opening Stock Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={form.stock_quantity}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          stock_quantity: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                    />
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Minimum Stock Alert Level *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={form.min_stock_level}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        min_stock_level: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Supplier Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.supplier_name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, supplier_name: e.target.value }))
                    }
                    placeholder="e.g. Balaji Wholesale Mart"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, expiry_date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Batch Information (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.batch_info}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, batch_info: e.target.value }))
                    }
                    placeholder="e.g. BATCH-2026-10"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>
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
                  {submitting
                    ? "Saving..."
                    : editingProduct
                      ? "Save Changes"
                      : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
