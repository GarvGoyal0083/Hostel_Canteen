"use client";

import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Search,
  Download,
  AlertTriangle,
  Edit3,
  Plus,
  X,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import {
  PaymentEntry,
  PaymentMethod,
  PaymentStatus,
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
import { PaymentStatusBadge } from "@/components/StatusBadge";

interface PaymentsViewProps {
  payments: PaymentEntry[];
  sales: SaleRecord[];
  onRefresh: () => void;
}

export function PaymentsView({
  payments,
  sales,
  onRefresh,
}: PaymentsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [duplicateOnly, setDuplicateOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Record Manual Payment Modal against an unpaid bill
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [newPayForm, setNewPayForm] = useState<{
    sale_id: string;
    payment_method: PaymentMethod;
    amount_received: string;
    upi_reference: string;
    notes: string;
  }>({
    sale_id: "",
    payment_method: "UPI",
    amount_received: "",
    upi_reference: "",
    notes: "",
  });
  const [dupUpiWarning, setDupUpiWarning] = useState<string[] | null>(null);

  // Authorized Payment Correction Modal
  const [editingPayment, setEditingPayment] = useState<PaymentEntry | null>(
    null
  );
  const [editForm, setEditForm] = useState<{
    payment_method: PaymentMethod;
    amount_received: string;
    upi_reference: string;
    payment_status: PaymentStatus;
    notes: string;
    correction_reason: string;
  }>({
    payment_method: "UPI",
    amount_received: "",
    upi_reference: "",
    payment_status: "Paid",
    notes: "",
    correction_reason: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const unpaidSales = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.sale_status !== "Cancelled" &&
          s.sale_status !== "Refunded" &&
          s.outstanding_amount > 0
      ),
    [sales]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter !== "ALL" && p.payment_method !== methodFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && p.payment_status !== statusFilter) {
        return false;
      }
      if (duplicateOnly && !p.is_duplicate_upi_warning) {
        return false;
      }
      const d = getISTDateString(p.payment_date);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.bill_number.toLowerCase().includes(q) ||
          (p.customer_name_snapshot &&
            p.customer_name_snapshot.toLowerCase().includes(q)) ||
          (p.upi_reference && p.upi_reference.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [
    payments,
    methodFilter,
    statusFilter,
    duplicateOnly,
    startDate,
    endDate,
    searchQuery,
  ]);

  const validFilteredPayments = useMemo(
    () =>
      filteredPayments.filter(
        (p) => p.payment_status !== "Failed" && p.payment_status !== "Refunded"
      ),
    [filteredPayments]
  );

  const cashTotal = useMemo(
    () =>
      round2(
        validFilteredPayments
          .filter((p) => p.payment_method === "Cash")
          .reduce((a, b) => a + b.amount_received, 0)
      ),
    [validFilteredPayments]
  );

  const upiTotal = useMemo(
    () =>
      round2(
        validFilteredPayments
          .filter((p) => p.payment_method === "UPI")
          .reduce((a, b) => a + b.amount_received, 0)
      ),
    [validFilteredPayments]
  );

  const duplicateCount = useMemo(
    () => payments.filter((p) => p.is_duplicate_upi_warning).length,
    [payments]
  );

  // Date-wise Cash & UPI Collection Summary
  const dateWiseCollections = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        cash: number;
        upi: number;
        other: number;
        total: number;
        count: number;
      }
    >();
    for (const p of validFilteredPayments) {
      const d = getISTDateString(p.payment_date);
      const row = map.get(d) || {
        date: d,
        cash: 0,
        upi: 0,
        other: 0,
        total: 0,
        count: 0,
      };
      if (p.payment_method === "Cash") {
        row.cash = round2(row.cash + p.amount_received);
      } else if (p.payment_method === "UPI") {
        row.upi = round2(row.upi + p.amount_received);
      } else {
        row.other = round2(row.other + p.amount_received);
      }
      row.total = round2(row.cash + row.upi + row.other);
      row.count += 1;
      map.set(d, row);
    }
    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [validFilteredPayments]);

  const checkLiveUpi = async (upiRef: string, excludeId?: string) => {
    const trimmed = upiRef.trim();
    if (!trimmed) {
      setDupUpiWarning(null);
      return;
    }
    try {
      const url = `/api/payments?checkUpiRef=${encodeURIComponent(trimmed)}${
        excludeId ? `&excludePaymentId=${encodeURIComponent(excludeId)}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.isDuplicate) {
          setDupUpiWarning(
            (data.matchingPayments || []).map(
              (m: { bill_number: string }) => m.bill_number
            )
          );
        } else {
          setDupUpiWarning(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const openRecordModal = () => {
    setErrorMsg(null);
    setDupUpiWarning(null);
    const firstBill = unpaidSales[0];
    setNewPayForm({
      sale_id: firstBill?.id || "",
      payment_method: "UPI",
      amount_received: firstBill ? String(firstBill.outstanding_amount) : "",
      upi_reference: "",
      notes: "",
    });
    setRecordModalOpen(true);
  };

  const handleRecordNewPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_id: newPayForm.sale_id,
          payment_method: newPayForm.payment_method,
          amount_received: parseFloat(newPayForm.amount_received),
          upi_reference: newPayForm.upi_reference.trim() || undefined,
          notes: newPayForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment.");

      setRecordModalOpen(false);
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPaymentModal = (p: PaymentEntry) => {
    setErrorMsg(null);
    setDupUpiWarning(null);
    setEditingPayment(p);
    setEditForm({
      payment_method: p.payment_method,
      amount_received: String(p.amount_received),
      upi_reference: p.upi_reference || "",
      payment_status: p.payment_status,
      notes: p.notes || "",
      correction_reason: "",
    });
  };

  const handleCorrectPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_method: editForm.payment_method,
          amount_received: parseFloat(editForm.amount_received),
          upi_reference: editForm.upi_reference.trim() || null,
          payment_status: editForm.payment_status,
          notes: editForm.notes,
          correction_reason: editForm.correction_reason,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to correct payment record.");

      setEditingPayment(null);
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to correct payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPaymentsCSV = () => {
    const timestamp = formatIST(new Date().toISOString());
    const headers = [
      "Payment ID",
      "Internal Bill ID",
      "Customer Name",
      "Room Number",
      "Payment Method",
      "Expected Bill Amount (INR)",
      "Amount Actually Received (INR)",
      "Manual UPI Transaction ID / UTR",
      "Duplicate UPI Warning",
      "Verification Mode",
      "Payment Status",
      "Payment Date & Time (IST)",
      "Recorded By Admin",
      "Notes",
    ];

    const lines: string[] = [
      "HOSTEL CANTEEN - MANUAL PAYMENTS & UPI LEDGER REPORT",
      `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
      `"Total Records Count",${filteredPayments.length}`,
      "",
      headers.map(escapeCSVCell).join(","),
    ];

    if (filteredPayments.length > 0) {
      filteredPayments.forEach((p) => {
        const row = [
          p.id,
          p.bill_number,
          p.customer_name_snapshot || "Walk-in",
          p.room_number_snapshot || "",
          p.payment_method,
          p.expected_amount,
          p.amount_received,
          p.upi_reference || "",
          p.is_duplicate_upi_warning ? "WARNING: Duplicate Reference" : "No",
          p.verification_status,
          p.payment_status,
          formatIST(p.payment_date),
          p.recorded_by,
          p.notes || "",
        ];
        lines.push(row.map(escapeCSVCell).join(","));
      });
    } else {
      lines.push(
        headers
          .map((_, i) => (i === 0 ? '"No payment records found"' : '""'))
          .join(",")
      );
    }

    downloadRawCSV("Hostel-Canteen-Manual-Payments.csv", lines.join("\r\n"));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Manual Payments &amp; UPI Collection Ledger
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track manually recorded Cash and UPI payments, UTR references, split payments, duplicate UTR warnings, and audited corrections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportPaymentsCSV}
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#111827] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button
            onClick={openRecordModal}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Explicit Manual Verification Disclaimer */}
      <div className="card-3d-static rounded-2xl bg-[#EFF6FF] border-blue-200 p-4 flex items-start gap-2.5 text-xs text-[#111827]">
        <ShieldAlert className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
        <div>
          <strong>Manual Payment Recording Mode (No Payment Gateway):</strong>{" "}
          All Cash and UPI payments (Google Pay, PhonePe, Paytm, etc.) and UTR
          reference numbers are manually entered by the admin. They are marked as{" "}
          <em>&ldquo;Manually Recorded (Not Independently Verified)&rdquo;</em>.
          Duplicate UPI references are flagged with a warning for review.
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Cash Collected (Filtered)
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {formatINR(cashTotal)}
          </span>
        </div>
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            UPI Recorded (Manual Entry)
          </span>
          <span className="text-2xl font-black text-[#2563EB] mt-1 block">
            {formatINR(upiTotal)}
          </span>
        </div>
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Total Collected
          </span>
          <span className="text-2xl font-black text-[#111827] mt-1 block">
            {formatINR(cashTotal + upiTotal)}
          </span>
        </div>
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-gray-500 font-medium block">
            Duplicate UPI Ref Warnings
          </span>
          <span
            className={`text-xl font-extrabold mt-1 block ${
              duplicateCount > 0 ? "text-amber-600" : "text-gray-700"
            }`}
          >
            {duplicateCount} Warning(s)
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs text-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bill ID, Customer, or UPI Ref / UTR..."
              className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-1.5 text-[#111827]"
            />
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[#111827]"
          >
            <option value="ALL">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[#111827]"
          >
            <option value="ALL">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-[#111827]"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-[#111827]"
          />
        </div>

        <label className="inline-flex items-center gap-1.5 font-semibold text-amber-800 cursor-pointer">
          <input
            type="checkbox"
            checked={duplicateOnly}
            onChange={(e) => setDuplicateOnly(e.target.checked)}
            className="rounded border-gray-300 text-[#2563EB]"
          />
          Duplicate UTR Warnings Only
        </label>
      </div>

      {/* Date-wise Cash and UPI Collection Report */}
      <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-xs">
        <h2 className="text-sm font-bold text-[#111827] mb-3">
          Date-Wise Cash & UPI Collection Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                <th className="px-3 py-2 font-semibold">Date (IST)</th>
                <th className="px-3 py-2 text-center font-semibold">
                  Payment Entries
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Cash Collected
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  UPI Collected (Manual)
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Other Collected
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Total Collected
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dateWiseCollections.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-4 text-center text-gray-500"
                  >
                    No collections recorded in selected filter.
                  </td>
                </tr>
              ) : (
                dateWiseCollections.map((d) => (
                  <tr key={d.date}>
                    <td className="px-3 py-2 font-semibold text-[#111827]">
                      {formatDateIST(d.date)}
                    </td>
                    <td className="px-3 py-2 text-center">{d.count}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {formatINR(d.cash)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#2563EB]">
                      {formatINR(d.upi)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatINR(d.other)}
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold text-[#111827]">
                      {formatINR(d.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Payment Entries Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Date & Time (IST)</th>
                <th className="px-4 py-3 font-semibold">Bill ID & Customer</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Expected Bill
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Amount Received
                </th>
                <th className="px-4 py-3 font-semibold">
                  Manual UPI Ref / UTR & Verification
                </th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Recorded By</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Correction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-gray-500"
                  >
                    No payment entries match your filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatIST(p.payment_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#2563EB]">
                        {p.bill_number}
                      </div>
                      <div className="text-[11px] text-gray-600">
                        {p.customer_name_snapshot || "Walk-in"}
                        {p.room_number_snapshot
                          ? ` (${p.room_number_snapshot})`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#111827]">
                      {p.payment_method}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatINR(p.expected_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold text-emerald-700">
                      {formatINR(p.amount_received)}
                    </td>
                    <td className="px-4 py-3">
                      {p.upi_reference ? (
                        <div className="font-mono font-bold text-[#1D4ED8]">
                          UTR: {p.upi_reference}
                        </div>
                      ) : (
                        <span className="text-gray-400">
                          {p.payment_method === "Cash"
                            ? "N/A (Cash)"
                            : "No Ref Entered"}
                        </span>
                      )}
                      <div className="text-[10px] text-gray-500">
                        {p.verification_status}
                      </div>
                      {p.is_duplicate_upi_warning && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          Duplicate UTR — Review Required
                        </div>
                      )}
                      {p.notes && (
                        <div className="text-[11px] text-gray-600 mt-0.5">
                          Note: {p.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PaymentStatusBadge status={p.payment_status} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.recorded_by}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEditPaymentModal(p)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-gray-100 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3 text-[#2563EB]" />
                        Correct
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Against Existing Bill Modal */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Record Manual Payment for Bill
              </h3>
              <button
                onClick={() => setRecordModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {unpaidSales.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-600 space-y-3">
                <p>All active bills are currently fully paid!</p>
                <button
                  onClick={() => setRecordModalOpen(false)}
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-white font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleRecordNewPayment}
                className="p-5 space-y-4 text-xs"
              >
                {errorMsg && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Select Unpaid / Partially Paid Bill *
                  </label>
                  <select
                    required
                    value={newPayForm.sale_id}
                    onChange={(e) => {
                      const sid = e.target.value;
                      const found = unpaidSales.find((s) => s.id === sid);
                      setNewPayForm((p) => ({
                        ...p,
                        sale_id: sid,
                        amount_received: found
                          ? String(found.outstanding_amount)
                          : "",
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                  >
                    {unpaidSales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.bill_number} — {s.customer_name_snapshot} (Due:{" "}
                        {formatINR(s.outstanding_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={newPayForm.payment_method}
                      onChange={(e) =>
                        setNewPayForm((p) => ({
                          ...p,
                          payment_method: e.target.value as PaymentMethod,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-[#111827]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI (Manual Ref)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Amount Received (₹) *
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      required
                      value={newPayForm.amount_received}
                      onChange={(e) =>
                        setNewPayForm((p) => ({
                          ...p,
                          amount_received: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                    />
                  </div>
                </div>

                {newPayForm.payment_method === "UPI" && (
                  <div>
                    <label className="font-semibold text-[#111827] block mb-1">
                      Manual UPI Transaction ID / UTR
                    </label>
                    <input
                      type="text"
                      value={newPayForm.upi_reference}
                      onChange={(e) => {
                        setNewPayForm((p) => ({
                          ...p,
                          upi_reference: e.target.value,
                        }));
                        checkLiveUpi(e.target.value);
                      }}
                      placeholder="Enter 12-digit UTR / UPI Reference"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[#111827]"
                    />
                    {dupUpiWarning && dupUpiWarning.length > 0 && (
                      <div className="mt-2 rounded-lg bg-amber-50 border border-amber-300 p-2.5 flex items-start gap-2 text-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>Duplicate UPI Ref Warning:</strong> Already
                          used on Bill {dupUpiWarning.join(", ")}.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPayForm.notes}
                    onChange={(e) =>
                      setNewPayForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecordModalOpen(false)}
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
                    {submitting ? "Recording..." : "Record Payment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Authorized Payment Correction Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Authorized Payment Correction — {editingPayment.bill_number}
              </h3>
              <button
                onClick={() => setEditingPayment(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCorrectPaymentSubmit}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editForm.payment_method}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        payment_method: e.target.value as PaymentMethod,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Amount Received (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={editForm.amount_received}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        amount_received: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Manual UPI Reference / UTR
                </label>
                <input
                  type="text"
                  value={editForm.upi_reference}
                  onChange={(e) => {
                    setEditForm((p) => ({
                      ...p,
                      upi_reference: e.target.value,
                    }));
                    checkLiveUpi(e.target.value, editingPayment.id);
                  }}
                  placeholder="Optional for Cash, UTR for UPI"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[#111827]"
                />
                {dupUpiWarning && dupUpiWarning.length > 0 && (
                  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-300 p-2 text-amber-900">
                    Duplicate UTR warning: also used on{" "}
                    {dupUpiWarning.join(", ")}.
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Payment Status
                </label>
                <select
                  value={editForm.payment_status}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      payment_status: e.target.value as PaymentStatus,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                  <option value="Refunded">Refunded</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Mandatory Audit Reason for Correction *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.correction_reason}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      correction_reason: e.target.value,
                    }))
                  }
                  placeholder="e.g. Fixed typo in manually entered UTR digit"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
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
                  {submitting ? "Saving..." : "Save Correction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
