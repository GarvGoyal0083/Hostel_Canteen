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
} from "lucide-react";
import { formatDateIST, formatINR, formatIST } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/StatusBadge";
import { Product, SaleRecord } from "@/types/pos";

interface DashboardProps {
  data: {
    environment_mode: "development_sample" | "production_clean";
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
      net_revenue: number;
      estimated_profit: number;
    }>;
    daily_series: Array<{
      date: string;
      sales: number;
      gross_profit: number;
      net_profit: number;
      expenses: number;
      cash_collected: number;
      upi_collected: number;
      transactions_count: number;
    }>;
    recent_transactions: SaleRecord[];
  };
  dateFilter: { startDate: string; endDate: string };
  onDateFilterChange: (start: string, end: string) => void;
  onNavigate: (tab: string) => void;
  onSelectReceipt: (sale: SaleRecord) => void;
  onRefresh: () => void;
}

export function DashboardView({
  data,
  dateFilter,
  onDateFilterChange,
  onNavigate,
  onSelectReceipt,
  onRefresh,
}: DashboardProps) {
  const { kpis, alerts, best_selling_products, daily_series, recent_transactions } =
    data;
  const [chartMetric, setChartMetric] = useState<"sales_profit" | "collections">(
    "sales_profit"
  );

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

  return (
    <div className="space-y-6">
      {/* Top Header & Date Range Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#111827]">
              Canteen Financial Dashboard
            </h1>
            <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#2563EB] border border-blue-200">
              Live Database Records
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Real-time sales, manual cash/UPI collections, inventory valuation, and profit metrics in IST.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-gray-500" />
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) =>
                onDateFilterChange(e.target.value, dateFilter.endDate)
              }
              className="text-xs text-[#111827] focus:outline-none"
              aria-label="Filter start date"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                onDateFilterChange(dateFilter.startDate, e.target.value)
              }
              className="text-xs text-[#111827] focus:outline-none"
              aria-label="Filter end date"
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                onClick={() => onDateFilterChange("", "")}
                className="ml-1 text-[#2563EB] hover:text-[#1D4ED8] font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-[#F3F4F6] transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={() => onNavigate("pos")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            New Sale (POS)
          </button>
        </div>
      </div>

      {/* Primary Row: Today, Weekly, Monthly Sales & Total Transactions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Today&apos;s Sales (IST)
            </span>
            <div className="rounded-lg bg-[#EFF6FF] p-2 text-[#2563EB]">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-[#111827]">
            {formatINR(kpis.today_sales)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
            <span>7-Day Weekly Sales:</span>
            <span className="font-semibold text-[#111827]">
              {formatINR(kpis.weekly_sales)}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Monthly Sales
            </span>
            <div className="rounded-lg bg-[#EFF6FF] p-2 text-[#2563EB]">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-[#111827]">
            {formatINR(kpis.monthly_sales)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
            <span>Transactions in Filter:</span>
            <span className="font-semibold text-[#2563EB]">
              {kpis.total_transactions} Bills
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Cash & UPI Collected
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-700">
            {formatINR(kpis.total_collected)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
            <span>Cash: {formatINR(kpis.cash_collected)}</span>
            <span className="font-semibold text-[#2563EB]">
              UPI: {formatINR(kpis.upi_collected)}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Estimated Net Profit
            </span>
            <div className="rounded-lg bg-[#EFF6FF] p-2 text-[#2563EB]">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div
            className={`mt-3 text-2xl font-extrabold ${
              kpis.period_net_profit >= 0 ? "text-[#111827]" : "text-red-600"
            }`}
          >
            {formatINR(kpis.period_net_profit)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
            <span>Gross Profit: {formatINR(kpis.period_gross_profit)}</span>
            <span>Expenses: {formatINR(kpis.period_expenses)}</span>
          </div>
        </div>
      </div>

      {/* Second Row: Discounts, Pending Udhaar, Inventory Value, Low Stock Alerts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-500 block">
              Total Discounts Given
            </span>
            <span className="text-lg font-bold text-[#111827] mt-0.5 block">
              {formatINR(kpis.period_discounts)}
            </span>
            <span className="text-[11px] text-gray-500">
              Gross Sales: {formatINR(kpis.period_gross_sales)}
            </span>
          </div>
          <div className="rounded-lg bg-[#F3F4F6] p-2.5 text-[#111827]">
            <Tag className="h-5 w-5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate("customers")}
          className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#2563EB] transition"
        >
          <div>
            <span className="text-xs font-medium text-gray-500 block">
              Pending Payments / Udhaar
            </span>
            <span className="text-lg font-bold text-amber-700 mt-0.5 block">
              {formatINR(kpis.pending_payments_amount)}
            </span>
            <span className="text-[11px] text-[#2563EB] font-medium">
              {kpis.pending_bills_count} unpaid bill(s) &rarr;
            </span>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 text-amber-700">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate("inventory")}
          className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#2563EB] transition"
        >
          <div>
            <span className="text-xs font-medium text-gray-500 block">
              Inventory Value (Cost)
            </span>
            <span className="text-lg font-bold text-[#111827] mt-0.5 block">
              {formatINR(kpis.current_inventory_value)}
            </span>
            <span className="text-[11px] text-gray-500">
              {kpis.active_products} active products (Retail:{" "}
              {formatINR(kpis.current_retail_inventory_value)})
            </span>
          </div>
          <div className="rounded-lg bg-[#EFF6FF] p-2.5 text-[#2563EB]">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate("inventory")}
          className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#2563EB] transition"
        >
          <div>
            <span className="text-xs font-medium text-gray-500 block">
              Stock Alerts
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-red-600">
                {kpis.out_of_stock_count} Out
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-lg font-bold text-amber-600">
                {kpis.low_stock_count} Low
              </span>
            </div>
            <span className="text-[11px] text-[#2563EB] font-medium">
              Restock inventory &rarr;
            </span>
          </div>
          <div className="rounded-lg bg-red-50 p-2.5 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Charts & Stock Alerts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Interactive Sales, Profit & Collections Bar Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-[#111827]">
                  Sales, Profit & Collection Trends
                </h2>
                <p className="text-xs text-gray-500">
                  Date-wise breakdown of net revenue, gross profit, and manual collections
                </p>
              </div>
              <div className="inline-flex rounded-lg bg-[#F3F4F6] p-1">
                <button
                  onClick={() => setChartMetric("sales_profit")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    chartMetric === "sales_profit"
                      ? "bg-[#2563EB] text-white"
                      : "text-[#111827] hover:bg-gray-200"
                  }`}
                >
                  Sales & Profit
                </button>
                <button
                  onClick={() => setChartMetric("collections")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    chartMetric === "collections"
                      ? "bg-[#2563EB] text-white"
                      : "text-[#111827] hover:bg-gray-200"
                  }`}
                >
                  Cash vs UPI
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs">
              {chartMetric === "sales_profit" ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#2563EB]" />
                    <span className="font-medium text-[#111827]">Net Sales</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#111827]" />
                    <span className="font-medium text-[#111827]">
                      Estimated Gross Profit
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-emerald-600" />
                    <span className="font-medium text-[#111827]">
                      Estimated Net Profit
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-emerald-600" />
                    <span className="font-medium text-[#111827]">
                      Cash Collected
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-xs bg-[#2563EB]" />
                    <span className="font-medium text-[#111827]">
                      UPI Collected (Manual)
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Bar Chart Visualization */}
            <div className="mt-6 h-56 flex items-end gap-3 overflow-x-auto pb-2 pt-4 px-2 border-b border-gray-200">
              {daily_series.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  No sales activity in selected date range.
                </div>
              ) : (
                daily_series.slice(-10).map((day) => {
                  const bar1 =
                    chartMetric === "sales_profit"
                      ? day.sales
                      : day.cash_collected;
                  const bar2 =
                    chartMetric === "sales_profit"
                      ? day.gross_profit
                      : day.upi_collected;
                  const bar3 =
                    chartMetric === "sales_profit"
                      ? Math.max(0, day.net_profit)
                      : 0;

                  const h1 = Math.max(4, Math.round((bar1 / maxChartVal) * 160));
                  const h2 = Math.max(4, Math.round((bar2 / maxChartVal) * 160));
                  const h3 = Math.max(4, Math.round((bar3 / maxChartVal) * 160));

                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[56px] flex flex-col items-center group"
                    >
                      <div className="text-[10px] font-semibold text-gray-600 mb-1 opacity-85 group-hover:opacity-100">
                        {formatINR(
                          chartMetric === "sales_profit"
                            ? day.sales
                            : day.cash_collected + day.upi_collected
                        )}
                      </div>
                      <div className="flex items-end gap-1 h-40">
                        <div
                          style={{ height: `${h1}px` }}
                          title={
                            chartMetric === "sales_profit"
                              ? `Sales: ${formatINR(bar1)}`
                              : `Cash: ${formatINR(bar1)}`
                          }
                          className={`w-3.5 rounded-t transition-all ${
                            chartMetric === "sales_profit"
                              ? "bg-[#2563EB]"
                              : "bg-emerald-600"
                          }`}
                        />
                        <div
                          style={{ height: `${h2}px` }}
                          title={
                            chartMetric === "sales_profit"
                              ? `Gross Profit: ${formatINR(bar2)}`
                              : `UPI: ${formatINR(bar2)}`
                          }
                          className={`w-3.5 rounded-t transition-all ${
                            chartMetric === "sales_profit"
                              ? "bg-[#111827]"
                              : "bg-[#2563EB]"
                          }`}
                        />
                        {chartMetric === "sales_profit" && (
                          <div
                            style={{ height: `${h3}px` }}
                            title={`Net Profit: ${formatINR(day.net_profit)}`}
                            className="w-3.5 rounded-t bg-emerald-600 transition-all"
                          />
                        )}
                      </div>
                      <span className="mt-2 text-[11px] font-medium text-gray-600">
                        {formatDateIST(day.date).slice(0, 6)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
            <span>
              COGS (Purchase Cost of Sold Items):{" "}
              <strong className="text-[#111827]">
                {formatINR(kpis.period_cogs)}
              </strong>
            </span>
            <button
              onClick={() => onNavigate("reports")}
              className="pos-link inline-flex items-center gap-1 cursor-pointer"
            >
              View Detailed Analytics &rarr;
            </button>
          </div>
        </div>

        {/* Low Stock & Out-of-Stock Alerts Panel */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-base font-bold text-[#111827]">
                  Low & Out-of-Stock Alerts
                </h2>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                {alerts.out_of_stock.length + alerts.low_stock.length} Items
              </span>
            </div>

            <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {alerts.out_of_stock.length === 0 &&
              alerts.low_stock.length === 0 ? (
                <div className="rounded-lg bg-emerald-50 p-4 text-xs text-emerald-800 border border-emerald-200">
                  All active products are stocked above their minimum alert levels!
                </div>
              ) : (
                <>
                  {alerts.out_of_stock.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-lg bg-red-50/70 p-3 border border-red-200"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#111827]">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-gray-600">
                          SKU: {prod.sku} • Min Alert: {prod.min_stock_level}
                        </div>
                      </div>
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-800 border border-red-300">
                        Out of Stock (0)
                      </span>
                    </div>
                  ))}
                  {alerts.low_stock.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between rounded-lg bg-amber-50/70 p-3 border border-amber-200"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#111827]">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-gray-600">
                          SKU: {prod.sku} • Min Alert: {prod.min_stock_level}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-300">
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
            className="mt-4 w-full rounded-lg bg-[#EFF6FF] py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-100 transition cursor-pointer"
          >
            Record Stock Purchase / Restock &rarr;
          </button>
        </div>
      </div>

      {/* Bottom Row: Best-Selling Products & Recent Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Best Selling Products */}
        <div className="lg:col-span-5 rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-[#111827]">
              Best-Selling Products
            </h2>
            <button
              onClick={() => onNavigate("products")}
              className="pos-link text-xs cursor-pointer"
            >
              All Products
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 text-center font-semibold">Sold</th>
                  <th className="pb-2 text-right font-semibold">Revenue</th>
                  <th className="pb-2 text-right font-semibold">Est. Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {best_selling_products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-gray-500"
                    >
                      No product sales recorded in this period.
                    </td>
                  </tr>
                ) : (
                  best_selling_products.slice(0, 6).map((item, idx) => (
                    <tr key={item.product_id}>
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EFF6FF] text-[11px] font-bold text-[#2563EB]">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-[#111827]">
                              {item.product_name}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {item.category}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center font-bold text-[#111827]">
                        {item.units_sold}
                      </td>
                      <td className="py-2.5 text-right font-medium text-[#111827]">
                        {formatINR(item.net_revenue)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-700">
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
        <div className="lg:col-span-7 rounded-xl bg-white p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-[#111827]">
              Recent Transactions
            </h2>
            <button
              onClick={() => onNavigate("transactions")}
              className="pos-link inline-flex items-center gap-1 text-xs cursor-pointer"
            >
              Full Transaction History
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-semibold">Bill ID</th>
                  <th className="pb-2 font-semibold">Customer / Room</th>
                  <th className="pb-2 text-right font-semibold">Payable</th>
                  <th className="pb-2 text-right font-semibold">Paid / Due</th>
                  <th className="pb-2 text-center font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent_transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-gray-500"
                    >
                      No transactions recorded yet. Click &ldquo;New Sale (POS)&rdquo; to create your first bill.
                    </td>
                  </tr>
                ) : (
                  recent_transactions.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-2">
                        <div className="font-bold text-[#2563EB]">
                          {sale.bill_number}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatIST(sale.created_at)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2">
                        <div className="font-semibold text-[#111827]">
                          {sale.customer_name_snapshot}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {sale.room_number_snapshot
                            ? `Room ${sale.room_number_snapshot}`
                            : "Walk-in"}
                          {" • "}
                          {sale.payment_methods_summary}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-[#111827]">
                        {formatINR(sale.payable_amount)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="font-semibold text-emerald-700">
                          Paid: {formatINR(sale.paid_amount)}
                        </div>
                        {sale.outstanding_amount > 0 && (
                          <div className="text-[11px] font-semibold text-amber-700">
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
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-[#EFF6FF] hover:text-[#2563EB] hover:border-blue-300 transition cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
