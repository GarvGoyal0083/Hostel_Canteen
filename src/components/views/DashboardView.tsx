"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Wallet,
  CreditCard,
  AlertTriangle,
  Package,
  Users,
  Tag,
  ArrowUpRight,
  Calendar,
  PlusCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  Store,
  SunMedium,
} from "lucide-react";
import { formatDateIST, formatINR, formatIST } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { CanteenStatus, Product, SaleRecord } from "@/types/pos";

interface DashboardProps {
  data: {
    environment_mode: "development_sample" | "production_clean";
    canteen_status?: CanteenStatus;
    kpis: {
      today_sales: number;
      weekly_sales: number;
      monthly_sales: number;
      period_gross_sales: number;
      period_discounts: number;
      period_refunds: number;
      period_net_sales: number;
      period_cogs: number;
      period_gross_profit: number;
      period_expenses: number;
      period_net_profit: number;
      total_transactions: number;
      cash_collected: number;
      upi_collected: number;
      other_collected: number;
      total_collected: number;
      pending_payments_amount: number;
      pending_bills_count: number;
      customer_udhaar_total: number;
      total_products: number;
      active_products: number;
      current_inventory_value: number;
      current_retail_inventory_value: number;
      low_stock_count: number;
      out_of_stock_count: number;
      duplicate_upi_warnings_count: number;
    };
    alerts: {
      out_of_stock: Product[];
      low_stock: Product[];
    };
    best_selling_products: Array<{
      product_id: string;
      product_name: string;
      sku: string;
      category: string;
      units_sold: number;
      gross_revenue: number;
      discounts: number;
      net_revenue: number;
      cogs: number;
      estimated_profit: number;
    }>;
    daily_series: Array<{
      date: string;
      sales: number;
      cogs: number;
      gross_profit: number;
      expenses: number;
      net_profit: number;
      cash_collected: number;
      upi_collected: number;
      discounts: number;
      transactions_count: number;
    }>;
    recent_transactions: SaleRecord[];
  };
  dateFilter: { startDate: string; endDate: string };
  onDateFilterChange: (start: string, end: string) => void;
  onNavigate: (tab: string) => void;
  onSelectReceipt: (sale: SaleRecord) => void;
  onRefresh: () => void;
  onOpenStatusModal?: () => void;
}

export function DashboardView({
  data,
  dateFilter,
  onDateFilterChange,
  onNavigate,
  onSelectReceipt,
  onRefresh,
  onOpenStatusModal,
}: DashboardProps) {
  const {
    kpis,
    alerts,
    best_selling_products,
    daily_series,
    recent_transactions,
    environment_mode,
    canteen_status,
  } = data;
  const [chartMetric, setChartMetric] = useState<"sales_profit" | "collections">(
    "sales_profit"
  );
  const [switchingMode, setSwitchingMode] = useState(false);

  const maxChartVal = Math.max(
    100,
    ...daily_series.map((d) =>
      Math.max(
        d.sales,
        d.gross_profit,
        d.cash_collected + d.upi_collected,
        Math.abs(d.net_profit)
      )
    )
  );

  const handleToggleDemoData = async () => {
    const target = environment_mode === "production_clean" ? "development_sample" : "production_clean";
    setSwitchingMode(true);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switch_mode", mode: target }),
      });
      if (res.ok) {
        onRefresh();
      }
    } finally {
      setSwitchingMode(false);
    }
  };

  const isZeroRecords = kpis.total_transactions === 0 && kpis.total_products === 0;

  return (
    <div className="space-y-6">
      {/* 3D Top Control Bar */}
      <div className="card-3d p-5 rounded-2xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
              Canteen Financial Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 px-3 py-1 text-xs font-bold text-[#2563EB] border border-blue-200/80 shadow-[0_2px_6px_rgba(37,99,235,0.08)]">
              <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
              Live Database
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            3D Financial Overview • Real-time sales, manual cash/UPI collections &amp; net profit in IST.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 3D Date Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-[#2563EB]" />
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) =>
                onDateFilterChange(e.target.value, dateFilter.endDate)
              }
              className="text-xs text-[#111827] font-semibold focus:outline-none"
              aria-label="Filter start date"
            />
            <span className="text-gray-400 font-bold">&rarr;</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                onDateFilterChange(dateFilter.startDate, e.target.value)
              }
              className="text-xs text-[#111827] font-semibold focus:outline-none"
              aria-label="Filter end date"
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                onClick={() => onDateFilterChange("", "")}
                className="ml-1 text-[#2563EB] hover:text-[#1D4ED8] font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {onOpenStatusModal && (
            <button
              type="button"
              onClick={onOpenStatusModal}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition cursor-pointer shadow-xs ${
                canteen_status?.is_open === false
                  ? "bg-red-50 border-red-300 text-red-800 hover:bg-red-100"
                  : "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  canteen_status?.is_open === false
                    ? "bg-red-500"
                    : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span>
                {canteen_status?.is_open === false ? "Shop Closed" : "Shop Open"}
              </span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="btn-3d-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#111827] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-gray-600" />
            Refresh
          </button>

          <button
            onClick={() => onNavigate("pos")}
            className="btn-3d-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            New Sale (POS)
          </button>
        </div>
      </div>

      {/* 3D Canteen Operating Status Banner (High Visibility) */}
      <div
        className={`card-3d rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 ${
          canteen_status?.is_open === false
            ? "border-l-red-500 bg-red-50/40"
            : "border-l-emerald-500 bg-emerald-50/30"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${
              canteen_status?.is_open === false ? "orb-3d-red" : "orb-3d-emerald"
            }`}
          >
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Shop Operating Status:
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-black shadow-2xs ${
                  canteen_status?.is_open === false
                    ? "bg-red-100 text-red-800 border border-red-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    canteen_status?.is_open === false
                      ? "bg-red-500"
                      : "bg-emerald-500 animate-pulse"
                  }`}
                />
                {canteen_status?.is_open === false ? "CLOSED" : "OPEN FOR ORDERS"}
              </span>
              {canteen_status?.is_open === false && canteen_status?.reopen_at && (
                <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                  Reopening: {canteen_status.reopen_at}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {canteen_status?.is_open === false
                ? (canteen_status.closure_reason || "Canteen is currently marked as closed. Customers see the closed notice.")
                : "Shop is live and accepting orders. Students can view active menu and stock."}
            </p>
          </div>
        </div>

        {onOpenStatusModal && (
          <button
            type="button"
            onClick={onOpenStatusModal}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 cursor-pointer transition shadow-sm ${
              canteen_status?.is_open === false
                ? "btn-3d-primary"
                : "btn-3d-secondary text-slate-800 border-red-200 hover:border-red-400 hover:text-red-700"
            }`}
          >
            {canteen_status?.is_open === false ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Re-Open Shop Now</span>
              </>
            ) : (
              <>
                <SunMedium className="h-4 w-4 text-amber-500" />
                <span>Close Shop (Today / Custom Time)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 3D Demo / Clean Production Banner */}
      {isZeroRecords && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] border border-white/10">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 h-48 w-48 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-500/30 border border-blue-400/40 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-200">
                  Clean Production State
                </span>
                <span className="text-xs text-gray-300">0 Sample Records</span>
              </div>
              <h3 className="text-base font-bold text-white">
                Ready for live canteen transactions or instant sample preview!
              </h3>
              <p className="text-xs text-gray-300 max-w-2xl">
                Start recording fresh hostel orders, or click below to populate realistic Kurkure, Lay&apos;s, cold drinks, student udhaar, and 3D charts for testing.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={switchingMode}
                onClick={handleToggleDemoData}
                className="btn-3d-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                {switchingMode ? "Loading..." : "Load Demo Snacks & Data"}
              </button>
              <button
                onClick={() => onNavigate("pos")}
                className="btn-3d-secondary px-3.5 py-2 text-xs font-bold text-[#111827] flex items-center gap-1 cursor-pointer"
              >
                Start POS Billing
                <ArrowRight className="h-3.5 w-3.5 text-[#2563EB]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary 3D KPI Cards (Row 1) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Sales */}
        <div className="card-3d rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Today&apos;s Sales (IST)
            </span>
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] p-2.5 transform group-hover:rotate-6 transition-transform">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#111827] tracking-tight">
            {formatINR(kpis.today_sales)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 border-t border-slate-100 pt-2 font-medium">
            <span>7-Day Weekly Sales:</span>
            <span className="font-bold text-[#111827]">
              {formatINR(kpis.weekly_sales)}
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Sales */}
        <div className="card-3d rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Monthly Sales
            </span>
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] p-2.5 transform group-hover:rotate-6 transition-transform">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-[#111827] tracking-tight">
            {formatINR(kpis.monthly_sales)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 border-t border-slate-100 pt-2 font-medium">
            <span>Transactions in Filter:</span>
            <span className="font-extrabold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md border border-blue-200">
              {kpis.total_transactions} Bills
            </span>
          </div>
        </div>

        {/* Card 3: Cash & UPI Collections */}
        <div className="card-3d rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Cash &amp; UPI Collected
            </span>
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_4px_14px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] p-2.5 transform group-hover:rotate-6 transition-transform">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-700 tracking-tight">
            {formatINR(kpis.total_collected)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 border-t border-slate-100 pt-2 font-medium">
            <span className="text-emerald-700 font-bold">Cash: {formatINR(kpis.cash_collected)}</span>
            <span className="font-bold text-[#2563EB]">UPI: {formatINR(kpis.upi_collected)}</span>
          </div>
        </div>

        {/* Card 4: Estimated Net Profit */}
        <div className="card-3d rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none transition-all group-hover:scale-110" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Estimated Net Profit
            </span>
            <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[0_4px_14px_rgba(15,23,42,0.3),inset_0_1px_1px_rgba(255,255,255,0.3)] p-2.5 transform group-hover:rotate-6 transition-transform">
              <CreditCard className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <div
            className={`mt-3 text-3xl font-black tracking-tight ${
              kpis.period_net_profit >= 0 ? "text-[#111827]" : "text-rose-600"
            }`}
          >
            {formatINR(kpis.period_net_profit)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-600 border-t border-slate-100 pt-2 font-medium">
            <span>Gross: <strong className="text-[#111827]">{formatINR(kpis.period_gross_profit)}</strong></span>
            <span>Expenses: <strong className="text-rose-600">{formatINR(kpis.period_expenses)}</strong></span>
          </div>
        </div>
      </div>

      {/* Secondary 3D Metric Cards (Row 2) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Discounts Card */}
        <div className="card-3d rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
              Discounts Given
            </span>
            <span className="text-xl font-black text-[#111827] mt-1 block">
              {formatINR(kpis.period_discounts)}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">
              Gross Sales: {formatINR(kpis.period_gross_sales)}
            </span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 text-white p-2.5 shadow-md">
            <Tag className="h-4 w-4" />
          </div>
        </div>

        {/* Pending Udhaar Card */}
        <div
          onClick={() => onNavigate("customers")}
          className="card-3d rounded-2xl p-4 flex items-center justify-between cursor-pointer"
        >
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide block">
              Pending Udhaar Due
            </span>
            <span className="text-xl font-black text-amber-700 mt-1 block">
              {formatINR(kpis.pending_payments_amount)}
            </span>
            <span className="text-[11px] text-[#2563EB] font-bold">
              {kpis.pending_bills_count} unpaid bill(s) &rarr;
            </span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white p-2.5 shadow-md shadow-amber-500/25">
            <Users className="h-4 w-4" />
          </div>
        </div>

        {/* Inventory Value Card */}
        <div
          onClick={() => onNavigate("inventory")}
          className="card-3d rounded-2xl p-4 flex items-center justify-between cursor-pointer"
        >
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
              Inventory Value (Cost)
            </span>
            <span className="text-xl font-black text-[#111827] mt-1 block">
              {formatINR(kpis.current_inventory_value)}
            </span>
            <span className="text-[11px] text-gray-500 font-medium">
              {kpis.active_products} products (Retail: {formatINR(kpis.current_retail_inventory_value)})
            </span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-2.5 shadow-md shadow-blue-500/25">
            <Package className="h-4 w-4" />
          </div>
        </div>

        {/* Stock Alerts Card */}
        <div
          onClick={() => onNavigate("inventory")}
          className="card-3d rounded-2xl p-4 flex items-center justify-between cursor-pointer"
        >
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block">
              Stock Alerts
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-black text-rose-600">
                {kpis.out_of_stock_count} Out
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-lg font-black text-amber-600">
                {kpis.low_stock_count} Low
              </span>
            </div>
            <span className="text-[11px] text-[#2563EB] font-bold">
              Restock inventory &rarr;
            </span>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white p-2.5 shadow-md shadow-red-500/25">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* 3D Charts & Stock Alerts Visualizer Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 3D Bar Chart Pillar Visualizer */}
        <div className="lg:col-span-2 card-3d rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#2563EB]" />
                  <h2 className="text-base font-extrabold text-[#111827]">
                    Sales, Profit &amp; Collection 3D Trends
                  </h2>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Physical 3D column perspective of net revenue, gross margins, and manual cash/UPI inflows
                </p>
              </div>

              {/* 3D Toggle Pill */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 shadow-inner">
                <button
                  onClick={() => setChartMetric("sales_profit")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    chartMetric === "sales_profit"
                      ? "btn-3d-primary"
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  Sales &amp; Profit
                </button>
                <button
                  onClick={() => setChartMetric("collections")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    chartMetric === "collections"
                      ? "btn-3d-primary"
                      : "text-gray-600 hover:text-black"
                  }`}
                >
                  Cash vs UPI
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
              {chartMetric === "sales_profit" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs chart-pillar-blue" />
                    <span className="text-[#111827]">Net Sales</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs chart-pillar-dark" />
                    <span className="text-[#111827]">Gross Profit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs chart-pillar-emerald" />
                    <span className="text-[#111827]">Net Profit</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs chart-pillar-emerald" />
                    <span className="text-[#111827]">Cash Received</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-xs chart-pillar-blue" />
                    <span className="text-[#111827]">UPI Recorded (Manual)</span>
                  </div>
                </>
              )}
            </div>

            {/* 3D Pillar Visualization Surface */}
            <div className="mt-6 h-60 flex items-end gap-3.5 overflow-x-auto pb-3 pt-6 px-4 bg-slate-50/70 rounded-2xl border border-slate-200/70 shadow-inner">
              {daily_series.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-500 gap-2">
                  <Layers className="h-6 w-6 text-gray-400" />
                  <span>No transactions recorded yet in this date filter.</span>
                </div>
              ) : (
                daily_series.slice(-10).map((day) => {
                  const bar1 =
                    chartMetric === "sales_profit" ? day.sales : day.cash_collected;
                  const bar2 =
                    chartMetric === "sales_profit" ? day.gross_profit : day.upi_collected;
                  const bar3 =
                    chartMetric === "sales_profit" ? Math.max(0, day.net_profit) : 0;

                  const h1 = Math.max(8, Math.round((bar1 / maxChartVal) * 165));
                  const h2 = Math.max(8, Math.round((bar2 / maxChartVal) * 165));
                  const h3 = Math.max(8, Math.round((bar3 / maxChartVal) * 165));

                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[58px] flex flex-col items-center group relative"
                    >
                      <div className="text-[10px] font-extrabold text-gray-700 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {formatINR(
                          chartMetric === "sales_profit"
                            ? day.sales
                            : day.cash_collected + day.upi_collected
                        )}
                      </div>
                      <div className="flex items-end gap-1.5 h-44">
                        <div
                          style={{ height: `${h1}px` }}
                          title={`Primary: ${formatINR(bar1)}`}
                          className={`w-4 rounded-t-md transition-all duration-300 transform group-hover:scale-y-105 ${
                            chartMetric === "sales_profit"
                              ? "chart-pillar-blue"
                              : "chart-pillar-emerald"
                          }`}
                        />
                        <div
                          style={{ height: `${h2}px` }}
                          title={`Secondary: ${formatINR(bar2)}`}
                          className={`w-4 rounded-t-md transition-all duration-300 transform group-hover:scale-y-105 ${
                            chartMetric === "sales_profit"
                              ? "chart-pillar-dark"
                              : "chart-pillar-blue"
                          }`}
                        />
                        {chartMetric === "sales_profit" && (
                          <div
                            style={{ height: `${h3}px` }}
                            title={`Net Profit: ${formatINR(day.net_profit)}`}
                            className="w-4 rounded-t-md chart-pillar-emerald transition-all duration-300 transform group-hover:scale-y-105"
                          />
                        )}
                      </div>
                      <span className="mt-2.5 text-[11px] font-bold text-gray-600">
                        {formatDateIST(day.date).slice(0, 6)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-gray-600 font-medium">
            <span>
              COGS (Cost of Sold Goods):{" "}
              <strong className="text-[#111827]">
                {formatINR(kpis.period_cogs)}
              </strong>
            </span>
            <button
              onClick={() => onNavigate("reports")}
              className="pos-link font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              View 12 Detailed Reports &rarr;
            </button>
          </div>
        </div>

        {/* 3D Low & Out-of-Stock Alerts Panel */}
        <div className="card-3d rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-300/40 flex items-center justify-center text-amber-600 shadow-xs">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#111827]">
                    Stock Alerts
                  </h2>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Immediate restock priorities
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900 border border-amber-300">
                {alerts.out_of_stock.length + alerts.low_stock.length} Items
              </span>
            </div>

            <div className="mt-4 space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {alerts.out_of_stock.length === 0 &&
              alerts.low_stock.length === 0 ? (
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/90 p-4 text-xs text-emerald-900 flex items-center gap-2.5 shadow-xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">
                    All products are safely stocked above their minimum threshold!
                  </span>
                </div>
              ) : (
                <>
                  {alerts.out_of_stock.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-xl bg-red-50/80 p-3 border border-red-200/90 shadow-xs"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#111827]">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-gray-600 font-mono">
                          {prod.sku} • Min Alert: {prod.min_stock_level}
                        </div>
                      </div>
                      <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs">
                        Out of Stock (0)
                      </span>
                    </div>
                  ))}
                  {alerts.low_stock.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-xl bg-amber-50/80 p-3 border border-amber-200/90 shadow-xs"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#111827]">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-gray-600 font-mono">
                          {prod.sku} • Min Alert: {prod.min_stock_level}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs">
                        {prod.stock_quantity} Left
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate("inventory")}
            className="mt-4 w-full btn-3d-secondary py-2.5 text-xs font-bold text-[#2563EB] cursor-pointer"
          >
            Record Stock Purchase / Restock &rarr;
          </button>
        </div>
      </div>

      {/* Bottom 3D Row: Best-Selling Products & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Best Selling Products */}
        <div className="lg:col-span-5 card-3d rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-[#111827]">
              Best-Selling Products
            </h2>
            <button
              onClick={() => onNavigate("products")}
              className="pos-link text-xs font-bold cursor-pointer"
            >
              All Products &rarr;
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-gray-500 font-bold">
                  <th className="pb-2 font-bold">Product</th>
                  <th className="pb-2 text-center font-bold">Sold</th>
                  <th className="pb-2 text-right font-bold">Revenue</th>
                  <th className="pb-2 text-right font-bold">Est. Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {best_selling_products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-gray-500 font-medium"
                    >
                      No product sales recorded in this period.
                    </td>
                  </tr>
                ) : (
                  best_selling_products.slice(0, 6).map((item, idx) => (
                    <tr key={item.product_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-black text-white shadow-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-[#111827]">
                              {item.product_name}
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium">
                              {item.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-black text-[#111827]">
                        {item.units_sold}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#111827]">
                        {formatINR(item.net_revenue)}
                      </td>
                      <td className="py-2.5 text-right font-black text-emerald-700">
                        +{formatINR(item.estimated_profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-7 card-3d rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-[#111827]">
              Recent Transactions
            </h2>
            <button
              onClick={() => onNavigate("transactions")}
              className="pos-link inline-flex items-center gap-1 text-xs font-bold cursor-pointer"
            >
              Full Transaction History
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-gray-500 font-bold">
                  <th className="pb-2 font-bold">Bill ID</th>
                  <th className="pb-2 font-bold">Customer / Room</th>
                  <th className="pb-2 text-right font-bold">Payable</th>
                  <th className="pb-2 text-right font-bold">Paid / Due</th>
                  <th className="pb-2 text-center font-bold">Status</th>
                  <th className="pb-2 text-right font-bold">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent_transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-gray-500 font-medium"
                    >
                      No transactions recorded yet. Tap &ldquo;New Sale (POS)&rdquo; to record your first sale.
                    </td>
                  </tr>
                ) : (
                  recent_transactions.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pr-2">
                        <div className="font-black text-[#2563EB]">
                          {sale.bill_number}
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">
                          {formatIST(sale.created_at)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="font-bold text-[#111827]">
                          {sale.customer_name_snapshot}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          {sale.room_number_snapshot
                            ? `Room ${sale.room_number_snapshot}`
                            : "Walk-in"}
                          {" • "}
                          {sale.payment_methods_summary}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-black text-[#111827]">
                        {formatINR(sale.payable_amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="font-bold text-emerald-700">
                          Paid: {formatINR(sale.paid_amount)}
                        </div>
                        {sale.outstanding_amount > 0 && (
                          <div className="text-[11px] font-extrabold text-amber-700">
                            Due: {formatINR(sale.outstanding_amount)}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <PaymentStatusBadge status={sale.payment_status} />
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => onSelectReceipt(sale)}
                          className="btn-3d-secondary inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#111827] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#2563EB]" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
