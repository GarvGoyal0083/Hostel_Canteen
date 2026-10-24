"use client";

import React, { useState, useMemo } from "react";
import {
  UserPlus,
  Search,
  Download,
  BookOpen,
  CreditCard,
  X,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import {
  Customer,
  CustomerLedgerEntry,
  PaymentEntry,
  PaymentMethod,
  SaleRecord,
} from "@/types/pos";
import { downloadCSV, formatINR, formatIST, round2 } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/StatusBadge";

interface CustomersViewProps {
  customers: Customer[];
  onRefresh: () => void;
  onSelectReceipt: (sale: SaleRecord) => void;
}

export function CustomersView({
  customers,
  onRefresh,
  onSelectReceipt,
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyWithDues, setOnlyWithDues] = useState(false);

  // Add Customer Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    room_number: "",
    phone: "",
    notes: "",
  });

  // Ledger Modal
  const [ledgerData, setLedgerData] = useState<{
    customer: Customer;
    sales: SaleRecord[];
    payments: PaymentEntry[];
    ledger: CustomerLedgerEntry[];
  } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Repay Udhaar Modal
  const [repayCustomer, setRepayCustomer] = useState<Customer | null>(null);
  const [repayForm, setRepayForm] = useState<{
    payment_method: PaymentMethod;
    amount_received: string;
    upi_reference: string;
    notes: string;
  }>({
    payment_method: "UPI",
    amount_received: "",
    upi_reference: "",
    notes: "",
  });
  const [dupUpiWarning, setDupUpiWarning] = useState<string[] | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (onlyWithDues && c.outstanding_dues <= 0) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.room_number && c.room_number.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, onlyWithDues, searchQuery]);

  const totalUdhaar = useMemo(
    () => round2(customers.reduce((acc, c) => acc + c.outstanding_dues, 0)),
    [customers]
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add customer.");
      setAddModalOpen(false);
      setNewForm({ name: "", room_number: "", phone: "", notes: "" });
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to create customer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCustomerLedger = async (customerId: string) => {
    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`);
      const data = await res.json();
      if (res.ok) {
        setLedgerData(data);
      }
    } finally {
      setLoadingLedger(false);
    }
  };

  const openRepayModal = (cust: Customer) => {
    setErrorMsg(null);
    setDupUpiWarning(null);
    setRepayCustomer(cust);
    setRepayForm({
      payment_method: "UPI",
      amount_received: String(cust.outstanding_dues),
      upi_reference: "",
      notes: `Udhaar settlement from Room ${cust.room_number || "N/A"}`,
    });
  };

  const checkLiveUpi = async (upiRef: string) => {
    const trimmed = upiRef.trim();
    if (!trimmed) {
      setDupUpiWarning(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/payments?checkUpiRef=${encodeURIComponent(trimmed)}`
      );
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

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayCustomer) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "repay_dues",
          customer_id: repayCustomer.id,
          payment_method: repayForm.payment_method,
          amount_received: parseFloat(repayForm.amount_received),
          upi_reference: repayForm.upi_reference.trim() || undefined,
          notes: repayForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record repayment.");

      setRepayCustomer(null);
      onRefresh();
      if (ledgerData && ledgerData.customer.id === repayCustomer.id) {
        openCustomerLedger(repayCustomer.id);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record repayment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCustomersCSV = () => {
    const rows = filteredCustomers.map((c) => ({
      "Customer Name": c.name,
      "Hostel Room Number": c.room_number || "",
      Phone: c.phone || "",
      "Registration Date (IST)": formatIST(c.registration_date),
      "Total Purchases (INR)": c.total_purchases,
      "Total Payments (INR)": c.total_payments,
      "Outstanding Dues / Udhaar (INR)": c.outstanding_dues,
      Notes: c.notes || "",
    }));
    downloadCSV("Hostel-Canteen-Customers-Udhaar.csv", rows);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Hostel Customer &amp; Udhaar Management
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Track hostel student purchases, room numbers, credit sales (udhaar), repayments, and full customer ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCustomersCSV}
            className="btn-3d-secondary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-[#111827] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setAddModalOpen(true);
            }}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Registered Hostel Students
          </span>
          <span className="text-2xl font-black text-[#111827] mt-1 block">
            {customers.length} Students
          </span>
        </div>
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Total Purchases by Students
          </span>
          <span className="text-2xl font-black text-[#2563EB] mt-1 block">
            {formatINR(
              customers.reduce((acc, c) => acc + c.total_purchases, 0)
            )}
          </span>
        </div>
        <div className="card-3d rounded-2xl p-5">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Total Outstanding Customer Udhaar
          </span>
          <span className="text-2xl font-black text-amber-700 mt-1 block">
            {formatINR(totalUdhaar)}
          </span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card-3d-static flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, room number (e.g. B-204), or phone..."
            className="input-3d w-full rounded-xl pl-9 pr-3 py-2 text-xs text-[#111827]"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-extrabold text-amber-900 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWithDues}
            onChange={(e) => setOnlyWithDues(e.target.checked)}
            className="rounded border-gray-300 text-[#2563EB]"
          />
          Show only students with Pending Udhaar
        </label>
      </div>

      {/* Customer Directory Table */}
      <div className="card-3d-static rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Student Name</th>
                <th className="px-4 py-3 font-semibold">Hostel Room</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Total Purchases
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Total Paid
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Outstanding Dues
                </th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-gray-500"
                  >
                    No customers match your filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#111827]">{c.name}</div>
                      {c.notes && (
                        <div className="text-[11px] text-gray-500">
                          {c.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.room_number ? (
                        <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 font-mono text-xs font-bold text-[#1D4ED8] border border-blue-200">
                          Room {c.room_number}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#111827]">
                      {formatINR(c.total_purchases)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {formatINR(c.total_payments)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.outstanding_dues > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                          {formatINR(c.outstanding_dues)} Due
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">
                          ₹0 (Settled)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {c.outstanding_dues > 0 && (
                          <button
                            onClick={() => openRepayModal(c)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Record Payment
                          </button>
                        )}
                        <button
                          onClick={() => openCustomerLedger(c.id)}
                          disabled={loadingLedger}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-[#F3F4F6] transition cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-[#2563EB]" />
                          Ledger & History
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

      {/* Add Customer Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Register Hostel Customer
              </h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={handleCreateCustomer}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  required
                  value={newForm.name}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Siddharth Roy"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Hostel Room Number (Optional)
                </label>
                <input
                  type="text"
                  value={newForm.room_number}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, room_number: e.target.value }))
                  }
                  placeholder="e.g. B-204"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={newForm.phone}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>
              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newForm.notes}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="e.g. Wing B 2nd Floor"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  {submitting ? "Saving..." : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Customer Dues Modal */}
      {repayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Record Udhaar Repayment — {repayCustomer.name}
              </h3>
              <button
                onClick={() => setRepayCustomer(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleRecordRepayment}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="rounded-lg bg-[#EFF6FF] p-3 border border-blue-200 flex items-center justify-between">
                <span className="font-semibold text-[#111827]">
                  Total Outstanding Balance:
                </span>
                <span className="text-base font-extrabold text-[#2563EB]">
                  {formatINR(repayCustomer.outstanding_dues)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={repayForm.payment_method}
                    onChange={(e) =>
                      setRepayForm((p) => ({
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
                    min="1"
                    max={repayCustomer.outstanding_dues}
                    step="0.5"
                    required
                    value={repayForm.amount_received}
                    onChange={(e) =>
                      setRepayForm((p) => ({
                        ...p,
                        amount_received: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                  />
                </div>
              </div>

              {repayForm.payment_method === "UPI" && (
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Manual UPI Transaction ID / UTR
                  </label>
                  <input
                    type="text"
                    value={repayForm.upi_reference}
                    onChange={(e) => {
                      setRepayForm((p) => ({
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
                        <strong>Duplicate UPI Ref Warning:</strong> This UTR was
                        already entered on Bill {dupUpiWarning.join(", ")}.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Payment Notes (Optional)
                </label>
                <input
                  type="text"
                  value={repayForm.notes}
                  onChange={(e) =>
                    setRepayForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRepayCustomer(null)}
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
          </div>
        </div>
      )}

      {/* Customer Ledger & Purchase History Modal */}
      {ledgerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-[#111827]">
                  Customer Ledger — {ledgerData.customer.name}{" "}
                  {ledgerData.customer.room_number
                    ? `(Room ${ledgerData.customer.room_number})`
                    : ""}
                </h3>
                <p className="text-xs text-gray-600">
                  Complete chronological history of purchases, manual payments, adjustments, and remaining dues
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ledgerData.customer.outstanding_dues > 0 && (
                  <button
                    onClick={() => openRepayModal(ledgerData.customer)}
                    className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    Record Repayment (
                    {formatINR(ledgerData.customer.outstanding_dues)})
                  </button>
                )}
                <button
                  onClick={() => setLedgerData(null)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              {/* Summary Strip */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-[#F3F4F6] p-3 border border-gray-200">
                  <span className="text-gray-500 block">Total Purchases</span>
                  <span className="text-lg font-bold text-[#111827]">
                    {formatINR(ledgerData.customer.total_purchases)}
                  </span>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200">
                  <span className="text-emerald-800 block">Total Paid</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {formatINR(ledgerData.customer.total_payments)}
                  </span>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                  <span className="text-amber-900 block">
                    Remaining Udhaar Due
                  </span>
                  <span className="text-lg font-bold text-amber-800">
                    {formatINR(ledgerData.customer.outstanding_dues)}
                  </span>
                </div>
              </div>

              {/* Ledger Table */}
              <div>
                <h4 className="font-bold text-[#111827] mb-2">
                  Chronological Account Ledger
                </h4>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F3F4F6] border-b border-gray-200 text-left text-gray-600">
                        <th className="px-3 py-2.5 font-semibold">
                          Date & Time (IST)
                        </th>
                        <th className="px-3 py-2.5 font-semibold">Type</th>
                        <th className="px-3 py-2.5 font-semibold">Bill Ref</th>
                        <th className="px-3 py-2.5 font-semibold">Details</th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Purchase (+)
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Payment/Adj (-)
                        </th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Balance After
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerData.ledger.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="py-6 text-center text-gray-500"
                          >
                            No ledger entries recorded yet for this student.
                          </td>
                        </tr>
                      ) : (
                        ledgerData.ledger.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                              {formatIST(entry.date)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  entry.type === "PURCHASE"
                                    ? "bg-[#EFF6FF] text-[#1D4ED8]"
                                    : entry.type === "PAYMENT"
                                      ? "bg-emerald-50 text-emerald-800"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-[#2563EB]">
                              {entry.reference_bill}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {entry.description}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-[#111827]">
                              {entry.debit_purchase > 0
                                ? formatINR(entry.debit_purchase)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                              {entry.credit_payment > 0
                                ? `-${formatINR(entry.credit_payment)}`
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-amber-800">
                              {formatINR(entry.balance_after)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Customer Bills List */}
              <div>
                <h4 className="font-bold text-[#111827] mb-2">
                  All Bills for {ledgerData.customer.name} (
                  {ledgerData.sales.length})
                </h4>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F3F4F6] border-b border-gray-200 text-left text-gray-600">
                        <th className="px-3 py-2 font-semibold">Bill ID</th>
                        <th className="px-3 py-2 font-semibold">Date (IST)</th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Payable
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Paid
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Due
                        </th>
                        <th className="px-3 py-2 text-center font-semibold">
                          Status
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Receipt
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerData.sales.map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-bold text-[#2563EB]">
                            {s.bill_number}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {formatIST(s.created_at)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {formatINR(s.payable_amount)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                            {formatINR(s.paid_amount)}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-800 font-bold">
                            {formatINR(s.outstanding_amount)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <PaymentStatusBadge status={s.payment_status} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => onSelectReceipt(s)}
                              className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-[11px] font-semibold text-[#111827] hover:bg-gray-100 cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
