"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  Calendar,
  BarChart3,
  PieChart,
  TrendingUp,
} from "lucide-react";
import {
  Customer,
  ExpenseRecord,
  InventoryMovement,
  PaymentEntry,
  Product,
  SaleRecord,
} from "@/types/pos";
import {
  downloadCSV,
  downloadRawCSV,
  escapeCSVCell,
  formatDateIST,
  formatINR,
  formatIST,
  getISTDateString,
  round2,
} from "@/lib/format";

type ReportType =
  | "daily_sales"
  | "weekly_sales"
  | "monthly_sales"
  | "product_sales"
  | "customer_purchases"
  | "payment_collections"
  | "discount_history"
  | "stock_purchases_adjustments"
  | "low_stock"
  | "damaged_expired"
  | "outstanding_dues"
  | "expenses_profit";

const REPORT_TABS: Array<{ id: ReportType; label: string }> = [
  { id: "daily_sales", label: "1. Daily Sales" },
  { id: "weekly_sales", label: "2. Weekly Sales" },
  { id: "monthly_sales", label: "3. Monthly Sales" },
  { id: "product_sales", label: "4. Product-Wise Sales" },
  { id: "customer_purchases", label: "5. Customer-Wise Purchases" },
  { id: "payment_collections", label: "6. Payment-Method Collections" },
  { id: "discount_history", label: "7. Discount History" },
  { id: "stock_purchases_adjustments", label: "8. Stock Purchases & Adj" },
  { id: "low_stock", label: "9. Low-Stock Products" },
  { id: "damaged_expired", label: "10. Damaged & Expired" },
  { id: "outstanding_dues", label: "11. Outstanding Customer Dues" },
  { id: "expenses_profit", label: "12. Expenses & Est. Profit" },
];

const REPORT_COLUMNS: Record<ReportType, string[]> = {
  daily_sales: [
    "Date (IST)",
    "Transactions",
    "Net Sales (INR)",
    "Discounts Given (INR)",
    "COGS (INR)",
    "Estimated Gross Profit (INR)",
    "Operating Expenses (INR)",
    "Estimated Net Profit (INR)",
    "Cash Collected (INR)",
    "UPI Collected (INR)",
  ],
  weekly_sales: [
    "Week Period",
    "Transactions",
    "Gross Sales (INR)",
    "Discounts (INR)",
    "Net Sales (INR)",
    "COGS (INR)",
    "Estimated Gross Profit (INR)",
  ],
  monthly_sales: [
    "Month",
    "Transactions",
    "Gross Sales (INR)",
    "Discounts (INR)",
    "Net Sales (INR)",
    "COGS (INR)",
    "Estimated Gross Profit (INR)",
  ],
  product_sales: [
    "SKU",
    "Product Name",
    "Category",
    "Units Sold",
    "Gross Revenue (INR)",
    "Discounts (INR)",
    "Net Revenue (INR)",
    "COGS (INR)",
    "Estimated Profit (INR)",
  ],
  customer_purchases: [
    "Student Name",
    "Hostel Room",
    "Phone",
    "Total Purchases (INR)",
    "Total Payments (INR)",
    "Outstanding Dues (INR)",
  ],
  payment_collections: [
    "Date & Time (IST)",
    "Bill ID",
    "Customer",
    "Payment Method",
    "Amount Received (INR)",
    "Manual UPI Ref / UTR",
    "Duplicate UTR Warning",
    "Payment Status",
    "Recorded By",
  ],
  discount_history: [
    "Bill ID",
    "Date (IST)",
    "Customer",
    "Original Subtotal (INR)",
    "Item-Level Discounts (INR)",
    "Bill-Level Discount (INR)",
    "Total Discount (INR)",
    "Final Payable (INR)",
    "Discount Reason",
    "Authorized By Admin",
  ],
  stock_purchases_adjustments: [
    "Date & Time (IST)",
    "Product",
    "SKU",
    "Movement Type",
    "Quantity Change",
    "Previous Stock",
    "Closing Stock",
    "Unit Cost (INR)",
    "Reference",
    "Reason",
    "Recorded By",
  ],
  low_stock: [
    "SKU",
    "Product",
    "Category",
    "Available Stock",
    "Min Alert Level",
    "Alert Status",
    "Purchase Price (INR)",
    "Supplier",
  ],
  damaged_expired: [
    "Date & Time (IST)",
    "Product",
    "SKU",
    "Loss Type",
    "Units Lost",
    "Unit Cost (INR)",
    "Estimated Loss Value (INR)",
    "Reason",
    "Recorded By",
  ],
  outstanding_dues: [
    "Student Name",
    "Hostel Room",
    "Phone",
    "Total Purchases (INR)",
    "Total Paid (INR)",
    "Pending Udhaar Due (INR)",
  ],
  expenses_profit: [
    "Date",
    "Expense Title",
    "Category",
    "Amount (INR)",
    "Description",
    "Supplier / Receipt Ref",
    "Recorded By",
  ],
};

interface ReportsViewProps {
  sales: SaleRecord[];
  payments: PaymentEntry[];
  products: Product[];
  customers: Customer[];
  movements: InventoryMovement[];
  expenses: ExpenseRecord[];
  bestSellingProducts: Array<{
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
  dailySeries: Array<{
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
  kpis: {
    cash_collected: number;
    upi_collected: number;
    other_collected: number;
    total_collected: number;
    period_gross_sales: number;
    period_discounts: number;
    period_net_sales: number;
    period_cogs: number;
    period_gross_profit: number;
    period_expenses: number;
    period_net_profit: number;
    pending_payments_amount: number;
  };
  dateFilter: { startDate: string; endDate: string };
  onDateFilterChange: (start: string, end: string) => void;
}

export function ReportsView({
  sales,
  payments,
  products,
  customers,
  movements,
  expenses,
  bestSellingProducts,
  dailySeries,
  kpis,
  dateFilter,
  onDateFilterChange,
}: ReportsViewProps) {
  const [activeReport, setActiveReport] = useState<ReportType>("daily_sales");

  // Compute Weekly Sales Aggregations
  const weeklyRows = useMemo(() => {
    const map = new Map<
      string,
      {
        week_label: string;
        transactions: number;
        gross_sales: number;
        discounts: number;
        net_sales: number;
        cogs: number;
        gross_profit: number;
      }
    >();
    for (const s of sales.filter((x) => x.sale_status !== "Cancelled")) {
      const d = new Date(s.created_at);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const weekKey = getISTDateString(monday);
      const row = map.get(weekKey) || {
        week_label: `Week starting ${formatDateIST(weekKey)}`,
        transactions: 0,
        gross_sales: 0,
        discounts: 0,
        net_sales: 0,
        cogs: 0,
        gross_profit: 0,
      };
      const netSale = round2(Math.max(0, s.payable_amount - s.refunded_amount));
      row.transactions += 1;
      row.gross_sales = round2(row.gross_sales + s.subtotal_amount);
      row.discounts = round2(row.discounts + s.total_discount_amount);
      row.net_sales = round2(row.net_sales + netSale);
      row.cogs = round2(row.cogs + s.cogs_amount);
      row.gross_profit = round2(row.net_sales - row.cogs);
      map.set(weekKey, row);
    }
    return Array.from(map.values());
  }, [sales]);

  // Compute Monthly Sales Aggregations
  const monthlyRows = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        transactions: number;
        gross_sales: number;
        discounts: number;
        net_sales: number;
        cogs: number;
        gross_profit: number;
      }
    >();
    for (const s of sales.filter((x) => x.sale_status !== "Cancelled")) {
      const monthKey = getISTDateString(s.created_at).slice(0, 7);
      const row = map.get(monthKey) || {
        month: monthKey,
        transactions: 0,
        gross_sales: 0,
        discounts: 0,
        net_sales: 0,
        cogs: 0,
        gross_profit: 0,
      };
      const netSale = round2(Math.max(0, s.payable_amount - s.refunded_amount));
      row.transactions += 1;
      row.gross_sales = round2(row.gross_sales + s.subtotal_amount);
      row.discounts = round2(row.discounts + s.total_discount_amount);
      row.net_sales = round2(row.net_sales + netSale);
      row.cogs = round2(row.cogs + s.cogs_amount);
      row.gross_profit = round2(row.net_sales - row.cogs);
      map.set(monthKey, row);
    }
    return Array.from(map.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  }, [sales]);

  // Build tabular rows for the currently active report
  const currentReportRows = useMemo<Record<string, unknown>[]>(() => {
    switch (activeReport) {
      case "daily_sales":
        return [...dailySeries]
          .reverse()
          .map((d) => ({
            "Date (IST)": formatDateIST(d.date),
            "Transactions": d.transactions_count,
            "Net Sales (INR)": d.sales,
            "Discounts Given (INR)": d.discounts,
            "COGS (INR)": d.cogs,
            "Estimated Gross Profit (INR)": d.gross_profit,
            "Operating Expenses (INR)": d.expenses,
            "Estimated Net Profit (INR)": d.net_profit,
            "Cash Collected (INR)": d.cash_collected,
            "UPI Collected (INR)": d.upi_collected,
          }));

      case "weekly_sales":
        return weeklyRows.map((w) => ({
          "Week Period": w.week_label,
          Transactions: w.transactions,
          "Gross Sales (INR)": w.gross_sales,
          "Discounts (INR)": w.discounts,
          "Net Sales (INR)": w.net_sales,
          "COGS (INR)": w.cogs,
          "Estimated Gross Profit (INR)": w.gross_profit,
        }));

      case "monthly_sales":
        return monthlyRows.map((m) => ({
          Month: m.month,
          Transactions: m.transactions,
          "Gross Sales (INR)": m.gross_sales,
          "Discounts (INR)": m.discounts,
          "Net Sales (INR)": m.net_sales,
          "COGS (INR)": m.cogs,
          "Estimated Gross Profit (INR)": m.gross_profit,
        }));

      case "product_sales":
        return bestSellingProducts.map((p) => ({
          SKU: p.sku,
          "Product Name": p.product_name,
          Category: p.category,
          "Units Sold": p.units_sold,
          "Gross Revenue (INR)": p.gross_revenue,
          "Discounts (INR)": p.discounts,
          "Net Revenue (INR)": p.net_revenue,
          "COGS (INR)": p.cogs,
          "Estimated Profit (INR)": p.estimated_profit,
        }));

      case "customer_purchases":
        return customers.map((c) => ({
          "Student Name": c.name,
          "Hostel Room": c.room_number || "—",
          Phone: c.phone || "—",
          "Total Purchases (INR)": c.total_purchases,
          "Total Payments (INR)": c.total_payments,
          "Outstanding Dues (INR)": c.outstanding_dues,
        }));

      case "payment_collections":
        return payments.map((p) => ({
          "Date & Time (IST)": formatIST(p.payment_date),
          "Bill ID": p.bill_number,
          Customer: p.customer_name_snapshot || "Walk-in",
          "Payment Method": p.payment_method,
          "Amount Received (INR)": p.amount_received,
          "Manual UPI Ref / UTR": p.upi_reference || "—",
          "Duplicate UTR Warning": p.is_duplicate_upi_warning ? "YES" : "No",
          "Payment Status": p.payment_status,
          "Recorded By": p.recorded_by,
        }));

      case "discount_history":
        return sales
          .filter((s) => s.total_discount_amount > 0)
          .map((s) => ({
            "Bill ID": s.bill_number,
            "Date (IST)": formatIST(s.created_at),
            Customer: s.customer_name_snapshot,
            "Original Subtotal (INR)": s.subtotal_amount,
            "Item-Level Discounts (INR)": s.item_discount_total,
            "Bill-Level Discount (INR)": s.bill_discount_amount,
            "Total Discount (INR)": s.total_discount_amount,
            "Final Payable (INR)": s.payable_amount,
            "Discount Reason": s.discount_reason || "—",
            "Authorized By Admin":
              s.discount_authorized_by || s.created_by,
          }));

      case "stock_purchases_adjustments":
        return movements
          .filter((m) => m.movement_type !== "SALE")
          .map((m) => ({
            "Date & Time (IST)": formatIST(m.created_at),
            Product: m.product_name_snapshot,
            SKU: m.sku_snapshot,
            "Movement Type": m.movement_type,
            "Quantity Change": m.quantity_change,
            "Previous Stock": m.previous_stock,
            "Closing Stock": m.new_stock,
            "Unit Cost (INR)": m.unit_cost,
            Reference: m.reference_id || "—",
            Reason: m.reason,
            "Recorded By": m.recorded_by,
          }));

      case "low_stock":
        return products
          .filter((p) => p.is_active && p.stock_quantity <= p.min_stock_level)
          .map((p) => ({
            SKU: p.sku,
            Product: p.name,
            Category: p.category,
            "Available Stock": p.stock_quantity,
            "Min Alert Level": p.min_stock_level,
            "Alert Status":
              p.stock_quantity === 0 ? "OUT OF STOCK" : "LOW STOCK",
            "Purchase Price (INR)": p.purchase_price,
            Supplier: p.supplier_name || "—",
          }));

      case "damaged_expired":
        return movements
          .filter((m) =>
            ["DAMAGED", "EXPIRED", "MISSING", "WASTED"].includes(
              m.movement_type
            )
          )
          .map((m) => ({
            "Date & Time (IST)": formatIST(m.created_at),
            Product: m.product_name_snapshot,
            SKU: m.sku_snapshot,
            "Loss Type": m.movement_type,
            "Units Lost": Math.abs(m.quantity_change),
            "Unit Cost (INR)": m.unit_cost,
            "Estimated Loss Value (INR)": round2(
              Math.abs(m.quantity_change) * m.unit_cost
            ),
            Reason: m.reason,
            "Recorded By": m.recorded_by,
          }));

      case "outstanding_dues":
        return customers
          .filter((c) => c.outstanding_dues > 0)
          .map((c) => ({
            "Student Name": c.name,
            "Hostel Room": c.room_number || "—",
            Phone: c.phone || "—",
            "Total Purchases (INR)": c.total_purchases,
            "Total Paid (INR)": c.total_payments,
            "Pending Udhaar Due (INR)": c.outstanding_dues,
          }));

      case "expenses_profit":
        return expenses
          .filter((e) => !e.is_voided)
          .map((e) => ({
            Date: formatDateIST(e.expense_date),
            "Expense Title": e.title,
            Category: e.category,
            "Amount (INR)": e.amount,
            Description: e.description || "—",
            "Supplier / Receipt Ref": e.supplier_or_receipt_ref || "—",
            "Recorded By": e.recorded_by,
          }));
    }
  }, [
    activeReport,
    dailySeries,
    weeklyRows,
    monthlyRows,
    bestSellingProducts,
    customers,
    payments,
    sales,
    movements,
    products,
    expenses,
  ]);

  const maxProductUnits = Math.max(
    1,
    ...bestSellingProducts.map((p) => p.units_sold)
  );

  const totalCollectionForChart = Math.max(
    1,
    kpis.cash_collected +
      kpis.upi_collected +
      kpis.other_collected +
      kpis.pending_payments_amount
  );

  const cashPct = Math.round(
    (kpis.cash_collected / totalCollectionForChart) * 100
  );
  const upiPct = Math.round(
    (kpis.upi_collected / totalCollectionForChart) * 100
  );
  const duePct = Math.max(0, 100 - cashPct - upiPct);

  const handleExportReportCSV = () => {
    const currentTab = REPORT_TABS.find((t) => t.id === activeReport);
    const reportTitle = currentTab?.label || activeReport;
    const timestamp = formatIST(new Date().toISOString());
    const dateRangeStr =
      dateFilter.startDate || dateFilter.endDate
        ? `${dateFilter.startDate || "Beginning"} to ${dateFilter.endDate || "Today"}`
        : "All Time";

    const headers =
      REPORT_COLUMNS[activeReport] ||
      (currentReportRows.length > 0 ? Object.keys(currentReportRows[0]) : []);

    const lines: string[] = [
      `HOSTEL CANTEEN - ${reportTitle.toUpperCase()} REPORT`,
      `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
      `"Date Period Filter",${escapeCSVCell(dateRangeStr)}`,
      `"Total Records Count",${currentReportRows.length}`,
      "",
      headers.map(escapeCSVCell).join(","),
    ];

    if (currentReportRows.length > 0) {
      currentReportRows.forEach((row) => {
        lines.push(headers.map((h) => escapeCSVCell(row[h])).join(","));
      });
    } else {
      lines.push(
        headers
          .map((_, idx) =>
            idx === 0
              ? '"No records found for this report in the selected period"'
              : '""'
          )
          .join(",")
      );
    }

    downloadRawCSV(
      `Hostel-Canteen-Report-${activeReport}.csv`,
      lines.join("\r\n")
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">
            Reports &amp; Analytics Center
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">
            12 comprehensive financial, inventory, discount, collection, and profit reports with visual charts and CSV export.
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
              className="text-xs text-[#111827]"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                onDateFilterChange(dateFilter.startDate, e.target.value)
              }
              className="text-xs text-[#111827]"
            />
            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                onClick={() => onDateFilterChange("", "")}
                className="ml-1 text-[#2563EB] font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <button
            onClick={handleExportReportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition shadow-xs cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export Report (CSV)
          </button>
        </div>
      </div>

      {/* Visual Analytics Charts Grid (Top-Selling Products, Payment Distribution, Profit Breakdown) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart 1: Top-Selling Products Bar Chart */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <BarChart3 className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Top-Selling Products (Units &amp; Profit)
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {bestSellingProducts.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">
                No product sales in selected range.
              </p>
            ) : (
              bestSellingProducts.slice(0, 5).map((p) => {
                const widthPct = Math.max(
                  10,
                  Math.round((p.units_sold / maxProductUnits) * 100)
                );
                return (
                  <div key={p.product_id} className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="truncate pr-2 text-[#111827]">
                        {p.product_name}
                      </span>
                      <span className="font-bold text-[#2563EB] shrink-0">
                        {p.units_sold} sold (+{formatINR(p.estimated_profit)})
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className="h-full rounded-full bg-[#2563EB]"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Payment Method & Udhaar Distribution */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <PieChart className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Payment Method &amp; Dues Distribution
            </h2>
          </div>

          {/* Horizontal Stacked Distribution Bar */}
          <div className="h-5 w-full rounded-lg bg-[#F3F4F6] overflow-hidden flex border border-gray-200">
            <div
              style={{ width: `${cashPct}%` }}
              className="bg-emerald-600 h-full"
              title={`Cash: ${cashPct}%`}
            />
            <div
              style={{ width: `${upiPct}%` }}
              className="bg-[#2563EB] h-full"
              title={`UPI: ${upiPct}%`}
            />
            <div
              style={{ width: `${duePct}%` }}
              className="bg-amber-500 h-full"
              title={`Pending Udhaar: ${duePct}%`}
            />
          </div>

          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                Cash Collected ({cashPct}%)
              </span>
              <span className="font-bold text-[#111827]">
                {formatINR(kpis.cash_collected)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#2563EB]" />
                Manual UPI Recorded ({upiPct}%)
              </span>
              <span className="font-bold text-[#2563EB]">
                {formatINR(kpis.upi_collected)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-gray-700">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                Outstanding Customer Udhaar ({duePct}%)
              </span>
              <span className="font-bold text-amber-800">
                {formatINR(kpis.pending_payments_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Chart 3: Profit & Cost Structure */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#111827]">
              Revenue, COGS &amp; Profit Estimate
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Net Sales Revenue:</span>
              <span className="font-bold text-[#111827]">
                {formatINR(kpis.period_net_sales)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Cost of Goods Sold (COGS):</span>
              <span className="font-semibold text-gray-800">
                {formatINR(kpis.period_cogs)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estimated Gross Profit:</span>
              <span className="font-bold text-[#2563EB]">
                {formatINR(kpis.period_gross_profit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Operating Expenses:</span>
              <span className="font-semibold text-red-600">
                {formatINR(kpis.period_expenses)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-extrabold">
              <span className="text-[#111827]">Estimated Net Profit:</span>
              <span
                className={
                  kpis.period_net_profit >= 0
                    ? "text-emerald-700"
                    : "text-red-600"
                }
              >
                {formatINR(kpis.period_net_profit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 12 Report Selector Pills */}
      <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                activeReport === tab.id
                  ? "bg-[#2563EB] text-white"
                  : "bg-[#F3F4F6] text-[#111827] hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Report Data Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3">
          <h3 className="text-sm font-bold text-[#111827]">
            {REPORT_TABS.find((t) => t.id === activeReport)?.label} (
            {currentReportRows.length} rows)
          </h3>
          <button
            onClick={handleExportReportCSV}
            className="pos-link text-xs cursor-pointer"
          >
            Download CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          {currentReportRows.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-500">
              No records found for this report in the selected period.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                  {Object.keys(currentReportRows[0]).map((col) => (
                    <th key={col} className="px-4 py-2.5 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentReportRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50">
                    {Object.entries(row).map(([col, val]) => (
                      <td key={col} className="px-4 py-2.5 text-[#111827]">
                        {typeof val === "number" && col.includes("(INR)")
                          ? formatINR(val)
                          : String(val ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
