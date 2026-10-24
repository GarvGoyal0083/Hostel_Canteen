"use client";

import React, { useState, useMemo } from "react";
import {
  Plus,
  Download,
  Ban,
  X,
  CheckCircle2,
  Calculator,
  Wallet,
} from "lucide-react";
import { ExpenseRecord } from "@/types/pos";
import {
  downloadCSV,
  formatDateIST,
  formatINR,
  getISTDateString,
  round2,
} from "@/lib/format";

const EXPENSE_CATEGORIES = [
  "Transportation",
  "Packaging & Supplies",
  "Refrigeration & Cooling",
  "Room Storage & Racks",
  "Cleaning & Hygiene",
  "Miscellaneous Operating Expense",
];

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  kpis: {
    period_gross_sales: number;
    period_discounts: number;
    period_refunds: number;
    period_net_sales: number;
    period_cogs: number;
    period_gross_profit: number;
    period_expenses: number;
    period_net_profit: number;
    cash_collected: number;
    upi_collected: number;
    other_collected: number;
    total_collected: number;
    pending_payments_amount: number;
    customer_udhaar_total: number;
  };
  onRefresh: () => void;
}

export function ExpensesView({
  expenses,
  kpis,
  onRefresh,
}: ExpensesViewProps) {
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showVoided, setShowVoided] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    category: "Transportation",
    amount: "",
    expense_date: getISTDateString(),
    description: "",
    supplier_or_receipt_ref: "",
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!showVoided && e.is_voided) return false;
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [expenses, showVoided, categoryFilter]);

  const totalActiveExpenses = useMemo(
    () =>
      round2(
        filteredExpenses
          .filter((e) => !e.is_voided)
          .reduce((a, b) => a + b.amount, 0)
      ),
    [filteredExpenses]
  );

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          amount: parseFloat(form.amount),
          expense_date: form.expense_date,
          description: form.description || undefined,
          supplier_or_receipt_ref: form.supplier_or_receipt_ref || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record expense.");

      setModalOpen(false);
      setForm({
        title: "",
        category: "Transportation",
        amount: "",
        expense_date: getISTDateString(),
        description: "",
        supplier_or_receipt_ref: "",
      });
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record expense."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidExpense = async (exp: ExpenseRecord) => {
    const reason = window.prompt(
      `Enter a reason to void expense "${exp.title}" (${formatINR(exp.amount)}):`
    );
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exp.id, void_reason: reason.trim() }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  const handleExportExpensesCSV = () => {
    const rows = filteredExpenses.map((e) => ({
      Date: e.expense_date,
      Title: e.title,
      Category: e.category,
      "Amount (INR)": e.amount,
      Description: e.description || "",
      "Supplier / Receipt Ref": e.supplier_or_receipt_ref || "",
      "Recorded By": e.recorded_by,
      Status: e.is_voided ? `Voided (${e.void_reason || ""})` : "Active",
    }));
    downloadCSV("Hostel-Canteen-Expenses.csv", rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Expenses &amp; Profit Tracking (P&amp;L)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track canteen operating expenses and reconcile Gross Sales, COGS, Gross Profit, Net Profit, Collections, and Udhaar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExpensesCSV}
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#111827] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setModalOpen(true);
            }}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Accounting Statement: Revenue vs Profit vs Actual Collections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Card: Income & Profit Statement */}
        <div className="card-3d rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Calculator className="h-4 w-4 text-[#2563EB]" />
            <h2 className="text-base font-black text-[#111827]">
              Profit &amp; Loss Statement (Accrual Revenue vs COGS)
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">
                1. Gross Sales Before Discounts:
              </span>
              <span className="font-bold text-[#111827]">
                {formatINR(kpis.period_gross_sales)}
              </span>
            </div>
            <div className="flex justify-between py-1 text-[#2563EB]">
              <span>2. Less: Discounts Given (Item + Bill):</span>
              <span className="font-semibold">
                -{formatINR(kpis.period_discounts)}
              </span>
            </div>
            {kpis.period_refunds > 0 && (
              <div className="flex justify-between py-1 text-red-600">
                <span>Less: Refunded Sales Value:</span>
                <span className="font-semibold">
                  -{formatINR(kpis.period_refunds)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-gray-200 font-bold text-[#111827]">
              <span>
                3. Net Sales Revenue (After Discounts &amp; Adjustments):
              </span>
              <span>{formatINR(kpis.period_net_sales)}</span>
            </div>
            <div className="flex justify-between py-1 text-gray-700">
              <span>
                4. Less: Cost of Goods Sold (COGS from Purchase Cost):
              </span>
              <span className="font-semibold">
                -{formatINR(kpis.period_cogs)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-200 font-bold text-[#2563EB] bg-[#EFF6FF] px-3 rounded-lg">
              <span>5. Estimated Gross Profit (Net Sales - COGS):</span>
              <span>{formatINR(kpis.period_gross_profit)}</span>
            </div>
            <div className="flex justify-between py-1 text-red-700">
              <span>6. Less: Recorded Operating Expenses:</span>
              <span className="font-semibold">
                -{formatINR(kpis.period_expenses)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 border-t-2 border-gray-300 text-sm font-extrabold text-[#111827]">
              <span>7. Estimated Net Profit:</span>
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

        {/* Right Card: Actual Collections vs Outstanding Customer Dues */}
        <div className="rounded-xl bg-white p-5 border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Wallet className="h-4 w-4 text-emerald-700" />
              <h2 className="text-base font-bold text-[#111827]">
                Actual Collections vs Customer Udhaar
              </h2>
            </div>

            <p className="text-xs text-gray-600">
              Credit sales (Udhaar) are <strong>never</strong> counted as
              collected Cash or UPI. Collections reflect only actual recorded
              payments.
            </p>

            <div className="space-y-2.5 text-xs pt-1">
              <div className="flex justify-between rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                <span className="font-semibold text-emerald-900">
                  8. Total Cash Collected:
                </span>
                <span className="text-sm font-extrabold text-emerald-800">
                  {formatINR(kpis.cash_collected)}
                </span>
              </div>

              <div className="flex justify-between rounded-lg bg-[#EFF6FF] p-3 border border-blue-200">
                <span className="font-semibold text-[#111827]">
                  9. Total UPI Payments Recorded (Manual):
                </span>
                <span className="text-sm font-extrabold text-[#2563EB]">
                  {formatINR(kpis.upi_collected)}
                </span>
              </div>

              {kpis.other_collected > 0 && (
                <div className="flex justify-between rounded-lg bg-[#F3F4F6] p-3 border border-gray-200">
                  <span className="font-semibold text-[#111827]">
                    Other Payments Recorded:
                  </span>
                  <span className="text-sm font-bold text-[#111827]">
                    {formatINR(kpis.other_collected)}
                  </span>
                </div>
              )}

              <div className="flex justify-between rounded-lg bg-amber-50 p-3 border border-amber-200">
                <span className="font-semibold text-amber-900">
                  10. Outstanding Customer Dues (Pending Udhaar):
                </span>
                <span className="text-sm font-extrabold text-amber-800">
                  {formatINR(kpis.pending_payments_amount)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-600">
              Total Actual Cash + UPI Inflow:
            </span>
            <span className="text-base font-extrabold text-[#111827]">
              {formatINR(kpis.total_collected)}
            </span>
          </div>
        </div>
      </div>

      {/* Expense Filter & Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#111827]">
              Operating Expenses Ledger (Active Total:{" "}
              {formatINR(totalActiveExpenses)})
            </h2>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-[#111827]"
            >
              <option value="ALL">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => setShowVoided(e.target.checked)}
              className="rounded border-gray-300 text-[#2563EB]"
            />
            Show voided expense entries
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Expense Date</th>
                <th className="px-4 py-3 font-semibold">Expense Title</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">
                  Description &amp; Supplier/Receipt Ref
                </th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Recorded By</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-gray-500"
                  >
                    No expenses recorded in this category.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((e) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-gray-50 ${
                      e.is_voided ? "opacity-55 line-through bg-gray-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {formatDateIST(e.expense_date)}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#111827]">
                      {e.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-gray-800 border border-gray-300">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{e.description || "—"}</div>
                      {e.supplier_or_receipt_ref && (
                        <div className="text-[11px] font-mono text-[#2563EB]">
                          Ref: {e.supplier_or_receipt_ref}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-red-700">
                      {formatINR(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.recorded_by}</td>
                    <td className="px-4 py-3 text-right">
                      {!e.is_voided ? (
                        <button
                          onClick={() => handleVoidExpense(e)}
                          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                        >
                          <Ban className="h-3 w-3" />
                          Void
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-500">
                          Voided
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Record Canteen Operating Expense
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateExpense}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="e.g. Auto transport from wholesale market"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={form.amount}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, amount: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, expense_date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Supplier / Receipt Ref
                  </label>
                  <input
                    type="text"
                    value={form.supplier_or_receipt_ref}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        supplier_or_receipt_ref: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Optional details"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
