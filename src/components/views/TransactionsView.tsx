"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  Eye,
  CreditCard,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { PaymentMethod, SaleRecord } from "@/types/pos";
import {
  downloadCSV,
  downloadRawCSV,
  escapeCSVCell,
  formatINR,
  formatIST,
  getISTDateString,
} from "@/lib/format";
import { PaymentStatusBadge, SaleStatusBadge } from "@/components/StatusBadge";

interface TransactionsViewProps {
  sales: SaleRecord[];
  onRefresh: () => void;
  onSelectReceipt: (sale: SaleRecord) => void;
}

export function TransactionsView({
  sales,
  onRefresh,
  onSelectReceipt,
}: TransactionsViewProps) {
  // 8-way filters + sorting
  const [billIdFilter, setBillIdFilter] = useState("");
  const [customerNameFilter, setCustomerNameFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [productNameFilter, setProductNameFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [upiRefFilter, setUpiRefFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "highest" | "lowest"
  >("newest");

  // Record Payment Modal for Pending/Partially Paid Bill
  const [payingSale, setPayingSale] = useState<SaleRecord | null>(null);
  const [payForm, setPayForm] = useState<{
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

  // Controlled Cancel / Refund Modal
  const [refundingSale, setRefundingSale] = useState<SaleRecord | null>(null);
  const [refundAction, setRefundAction] = useState<
    "CANCEL" | "FULL_REFUND" | "PARTIAL_REFUND"
  >("CANCEL");
  const [restockItems, setRestockItems] = useState(true);
  const [refundMethod, setRefundMethod] = useState<
    "Cash" | "UPI" | "Other" | "Credit Adjustment" | "None"
  >("Cash");
  const [refundReason, setRefundReason] = useState("");
  const [partialQuantities, setPartialQuantities] = useState<
    Record<string, number>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredSales = useMemo(() => {
    const list = sales.filter((s) => {
      if (
        billIdFilter.trim() &&
        !s.bill_number.toLowerCase().includes(billIdFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        customerNameFilter.trim() &&
        !s.customer_name_snapshot
          .toLowerCase()
          .includes(customerNameFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        roomFilter.trim() &&
        (!s.room_number_snapshot ||
          !s.room_number_snapshot
            .toLowerCase()
            .includes(roomFilter.trim().toLowerCase()))
      ) {
        return false;
      }
      if (
        productNameFilter.trim() &&
        !s.items.some(
          (i) =>
            i.product_name_snapshot
              .toLowerCase()
              .includes(productNameFilter.trim().toLowerCase()) ||
            i.sku_snapshot
              .toLowerCase()
              .includes(productNameFilter.trim().toLowerCase())
        )
      ) {
        return false;
      }
      const d = getISTDateString(s.created_at);
      if (startDateFilter && d < startDateFilter) return false;
      if (endDateFilter && d > endDateFilter) return false;
      if (paymentMethodFilter !== "ALL") {
        const m = paymentMethodFilter.toLowerCase();
        const matchSummary = s.payment_methods_summary
          .toLowerCase()
          .includes(m);
        const matchEntry = s.payments.some(
          (p) => p.payment_method.toLowerCase() === m
        );
        if (!matchSummary && !matchEntry) return false;
      }
      if (
        paymentStatusFilter !== "ALL" &&
        s.payment_status !== paymentStatusFilter
      ) {
        return false;
      }
      if (upiRefFilter.trim()) {
        const q = upiRefFilter.trim().toLowerCase();
        const matchSummary =
          s.upi_references_summary &&
          s.upi_references_summary.toLowerCase().includes(q);
        const matchEntry = s.payments.some(
          (p) => p.upi_reference && p.upi_reference.toLowerCase().includes(q)
        );
        if (!matchSummary && !matchEntry) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortBy === "highest") {
        return b.payable_amount - a.payable_amount;
      }
      if (sortBy === "lowest") {
        return a.payable_amount - b.payable_amount;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [
    sales,
    billIdFilter,
    customerNameFilter,
    roomFilter,
    productNameFilter,
    startDateFilter,
    endDateFilter,
    paymentMethodFilter,
    paymentStatusFilter,
    upiRefFilter,
    sortBy,
  ]);

  const clearFilters = () => {
    setBillIdFilter("");
    setCustomerNameFilter("");
    setRoomFilter("");
    setProductNameFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setPaymentMethodFilter("ALL");
    setPaymentStatusFilter("ALL");
    setUpiRefFilter("");
    setSortBy("newest");
  };

  const openPayModal = (sale: SaleRecord) => {
    setErrorMsg(null);
    setDupUpiWarning(null);
    setPayingSale(sale);
    setPayForm({
      payment_method: "UPI",
      amount_received: String(sale.outstanding_amount),
      upi_reference: "",
      notes: `Payment for Bill ${sale.bill_number}`,
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

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSale) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_id: payingSale.id,
          payment_method: payForm.payment_method,
          amount_received: parseFloat(payForm.amount_received),
          upi_reference: payForm.upi_reference.trim() || undefined,
          notes: payForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment.");

      setPayingSale(null);
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record payment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openRefundModal = (sale: SaleRecord) => {
    setErrorMsg(null);
    setRefundingSale(sale);
    setRefundAction(sale.paid_amount > 0 ? "FULL_REFUND" : "CANCEL");
    setRestockItems(true);
    setRefundMethod(sale.paid_amount > 0 ? "Cash" : "None");
    setRefundReason("");
    const initMap: Record<string, number> = {};
    sale.items.forEach((i) => {
      initMap[i.product_id] = 0;
    });
    setPartialQuantities(initMap);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingSale) return;
    setErrorMsg(null);

    if (!refundReason.trim()) {
      setErrorMsg(
        "Please provide an authorization reason for this cancellation/refund."
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm ${refundAction} for Bill ${refundingSale.bill_number}?\nRestock items: ${restockItems ? "Yes" : "No"}\nReason: ${refundReason}`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/${refundingSale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: refundAction,
          reason: refundReason,
          restock_items: restockItems,
          refund_method: refundMethod,
          partial_items:
            refundAction === "PARTIAL_REFUND"
              ? Object.entries(partialQuantities)
                  .filter(([, q]) => q > 0)
                  .map(([product_id, quantity_to_refund]) => ({
                    product_id,
                    quantity_to_refund,
                  }))
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to process refund/cancellation.");

      setRefundingSale(null);
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to process action."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportTransactionsCSV = () => {
    const timestamp = formatIST(new Date().toISOString());
    const headers = [
      "Internal Bill ID",
      "Sale Date & Time (IST)",
      "Customer Name",
      "Hostel Room Number",
      "Products Purchased",
      "Original Subtotal (INR)",
      "Item Discounts (INR)",
      "Bill Discount (INR)",
      "Total Discount (INR)",
      "Discount Reason",
      "Discount Authorized By",
      "Final Payable Amount (INR)",
      "Total Amount Received (INR)",
      "Refunded Amount (INR)",
      "Outstanding Balance (INR)",
      "COGS (INR)",
      "Estimated Gross Profit (INR)",
      "Payment Methods Used",
      "Manual UPI Transaction Ref / UTR",
      "Latest Payment Date & Time (IST)",
      "Payment Status",
      "Sale Status",
      "Created / Modified By Admin",
      "Refund / Cancellation Details",
    ];

    const lines: string[] = [
      "HOSTEL CANTEEN - TRANSACTIONS & BILLING HISTORY REPORT",
      `"Generated At (IST)",${escapeCSVCell(timestamp)}`,
      `"Total Records Count",${filteredSales.length}`,
      "",
      headers.map(escapeCSVCell).join(","),
    ];

    if (filteredSales.length > 0) {
      filteredSales.forEach((s) => {
        const row = [
          s.bill_number,
          formatIST(s.created_at),
          s.customer_name_snapshot,
          s.room_number_snapshot || "",
          s.items
            .map(
              (i) =>
                `${i.product_name_snapshot} [Qty: ${i.quantity}, Cost: ₹${i.purchase_price_at_sale}, Sell: ₹${i.selling_price_at_sale}]`
            )
            .join(" | "),
          s.subtotal_amount,
          s.item_discount_total,
          s.bill_discount_amount,
          s.total_discount_amount,
          s.discount_reason || "",
          s.discount_authorized_by || "",
          s.payable_amount,
          s.paid_amount,
          s.refunded_amount,
          s.outstanding_amount,
          s.cogs_amount,
          s.estimated_gross_profit,
          s.payment_methods_summary,
          s.upi_references_summary || "",
          s.payments.length > 0 ? formatIST(s.payments[0].payment_date) : "",
          s.payment_status,
          s.sale_status,
          s.updated_by || s.created_by,
          (s.refunds || [])
            .map((r) => `${r.action_type}: ₹${r.refund_amount} (${r.reason})`)
            .join(" | "),
        ];
        lines.push(row.map(escapeCSVCell).join(","));
      });
    } else {
      lines.push(
        headers
          .map((_, i) =>
            i === 0 ? '"No transaction records found for the filter"' : '""'
          )
          .join(",")
      );
    }

    downloadRawCSV(
      "Hostel-Canteen-Transactions-History.csv",
      lines.join("\r\n")
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card-3d-static flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 rounded-2xl">
        <div>
          <h1 className="text-xl font-black text-[#111827]">
            Complete Transaction History
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Permanent financial ledger of every sale, item cost, discount, manual UPI reference, udhaar balance, and controlled refund.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportTransactionsCSV}
            className="btn-3d-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export Report (CSV)
          </button>
        </div>
      </div>

      {/* 8-Way Search & Filter Panel */}
      <div className="card-3d-static rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-[#111827] flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[#2563EB]" />
            Filter &amp; Sort Transactions ({filteredSales.length} of {sales.length}{" "}
            Bills)
          </span>
          <button
            onClick={clearFilters}
            className="text-xs font-extrabold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 text-xs">
          <input
            type="text"
            value={billIdFilter}
            onChange={(e) => setBillIdFilter(e.target.value)}
            placeholder="1. Bill ID (e.g. HC-2026...)"
            className="input-3d rounded-xl px-3 py-2 text-[#111827]"
          />
          <input
            type="text"
            value={customerNameFilter}
            onChange={(e) => setCustomerNameFilter(e.target.value)}
            placeholder="2. Customer Name..."
            className="input-3d rounded-xl px-3 py-2 text-[#111827]"
          />
          <input
            type="text"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            placeholder="3. Room Number (e.g. B-204)..."
            className="input-3d rounded-xl px-3 py-2 text-[#111827]"
          />
          <input
            type="text"
            value={productNameFilter}
            onChange={(e) => setProductNameFilter(e.target.value)}
            placeholder="4. Product Name or SKU..."
            className="input-3d rounded-xl px-3 py-2 text-[#111827]"
          />
          <input
            type="text"
            value={upiRefFilter}
            onChange={(e) => setUpiRefFilter(e.target.value)}
            placeholder="5. Manual UPI Ref / UTR..."
            className="input-3d rounded-xl px-3 py-2 font-mono text-[#111827]"
          />

          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-[11px]">From:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[#111827]"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-[11px]">To:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-[#111827]"
            />
          </div>

          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[#111827]"
          >
            <option value="ALL">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Other">Other</option>
            <option value="Unpaid">Unpaid / Udhaar</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[#111827]"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Pending">Pending (Udhaar)</option>
            <option value="Failed">Failed</option>
            <option value="Refunded">Refunded</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as "newest" | "oldest" | "highest" | "lowest"
              )
            }
            className="rounded-lg border border-blue-300 bg-[#EFF6FF] px-2.5 py-1.5 font-semibold text-[#1D4ED8]"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="highest">Sort: Highest Amount</option>
            <option value="lowest">Sort: Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-[#F3F4F6] text-left text-gray-600">
                <th className="px-4 py-3 font-semibold">Bill ID & Date (IST)</th>
                <th className="px-4 py-3 font-semibold">Customer & Room</th>
                <th className="px-4 py-3 font-semibold">
                  Items Purchased (Cost / Price)
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Subtotal & Disc
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Payable / Paid / Due
                </th>
                <th className="px-4 py-3 font-semibold">
                  Method & Manual UPI Ref
                </th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-gray-500"
                  >
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#2563EB]">
                        {sale.bill_number}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Sale: {formatIST(sale.created_at)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        By: {sale.created_by}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-bold text-[#111827]">
                        {sale.customer_name_snapshot}
                      </div>
                      {sale.room_number_snapshot && (
                        <span className="mt-0.5 inline-block rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                          Room {sale.room_number_snapshot}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="space-y-1">
                        {sale.items.map((item) => (
                          <div
                            key={item.id}
                            className="text-[11px] text-[#111827] leading-tight"
                          >
                            <span className="font-semibold">
                              {item.product_name_snapshot}
                            </span>{" "}
                            × {item.quantity}
                            <span className="text-gray-500 ml-1">
                              (Cost: {formatINR(item.purchase_price_at_sale)},
                              Sell: {formatINR(item.selling_price_at_sale)})
                            </span>
                            {item.refunded_quantity > 0 && (
                              <span className="ml-1 text-red-600 font-semibold">
                                [Refunded: {item.refunded_quantity}]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="text-gray-600">
                        Sub: {formatINR(sale.subtotal_amount)}
                      </div>
                      {sale.total_discount_amount > 0 && (
                        <div className="text-[11px] text-[#2563EB] font-medium">
                          Disc: -{formatINR(sale.total_discount_amount)}
                          {sale.discount_reason && (
                            <div className="text-[10px] text-gray-500">
                              ({sale.discount_reason})
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="font-extrabold text-[#111827]">
                        Payable: {formatINR(sale.payable_amount)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        Paid: {formatINR(sale.paid_amount)}
                      </div>
                      {sale.outstanding_amount > 0 && (
                        <div className="text-[11px] font-bold text-amber-800">
                          Due: {formatINR(sale.outstanding_amount)}
                        </div>
                      )}
                      {sale.refunded_amount > 0 && (
                        <div className="text-[11px] font-semibold text-red-600">
                          Refunded: {formatINR(sale.refunded_amount)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#111827]">
                        {sale.payment_methods_summary}
                      </div>
                      {sale.upi_references_summary && (
                        <div className="text-[11px] font-mono text-[#1D4ED8] mt-0.5">
                          UTR: {sale.upi_references_summary}
                        </div>
                      )}
                      {sale.payments.some(
                        (p) => p.is_duplicate_upi_warning
                      ) && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          Duplicate UTR Warning
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <PaymentStatusBadge status={sale.payment_status} />
                        <SaleStatusBadge status={sale.sale_status} />
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          onClick={() => onSelectReceipt(sale)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] hover:bg-gray-100 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#2563EB]" />
                          Receipt
                        </button>

                        {sale.outstanding_amount > 0 &&
                          sale.sale_status !== "Cancelled" &&
                          sale.sale_status !== "Refunded" && (
                            <button
                              onClick={() => openPayModal(sale)}
                              className="inline-flex items-center gap-1 rounded-md bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Record Payment
                            </button>
                          )}

                        {sale.sale_status !== "Cancelled" &&
                          sale.sale_status !== "Refunded" && (
                            <button
                              onClick={() => openRefundModal(sale)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Cancel / Refund
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {payingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Record Payment — {payingSale.bill_number}
              </h3>
              <button
                onClick={() => setPayingSale(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleRecordPaymentSubmit}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="rounded-lg bg-[#EFF6FF] p-3 border border-blue-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-bold text-[#111827]">
                    {payingSale.customer_name_snapshot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bill Payable:</span>
                  <span className="font-semibold">
                    {formatINR(payingSale.payable_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining Balance Due:</span>
                  <span className="font-extrabold text-[#2563EB]">
                    {formatINR(payingSale.outstanding_amount)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) =>
                      setPayForm((p) => ({
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
                    max={payingSale.outstanding_amount}
                    step="0.5"
                    required
                    value={payForm.amount_received}
                    onChange={(e) =>
                      setPayForm((p) => ({
                        ...p,
                        amount_received: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#111827]"
                  />
                </div>
              </div>

              {payForm.payment_method === "UPI" && (
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Manual UPI Transaction ID / UTR
                  </label>
                  <input
                    type="text"
                    value={payForm.upi_reference}
                    onChange={(e) => {
                      setPayForm((p) => ({
                        ...p,
                        upi_reference: e.target.value,
                      }));
                      checkLiveUpi(e.target.value);
                    }}
                    placeholder="Enter 12-digit UTR manually"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[#111827]"
                  />
                  {dupUpiWarning && dupUpiWarning.length > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-300 p-2.5 flex items-start gap-2 text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Duplicate UPI Ref Warning:</strong> This UTR was
                        already recorded on Bill {dupUpiWarning.join(", ")}.
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
                  value={payForm.notes}
                  onChange={(e) =>
                    setPayForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingSale(null)}
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
                  {submitting ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Controlled Cancellation / Refund Modal */}
      {refundingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-gray-200 bg-[#F3F4F6] px-5 py-3.5">
              <h3 className="text-base font-bold text-[#111827]">
                Controlled Cancellation / Refund — {refundingSale.bill_number}
              </h3>
              <button
                onClick={() => setRefundingSale(null)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleRefundSubmit}
              className="p-5 space-y-4 text-xs"
            >
              {errorMsg && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">
                  {errorMsg}
                </div>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
                Completed financial records are never permanently deleted. This workflow records an audited cancellation or refund and safely restores returned stock.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Action Type *
                  </label>
                  <select
                    value={refundAction}
                    onChange={(e) =>
                      setRefundAction(
                        e.target.value as
                          | "CANCEL"
                          | "FULL_REFUND"
                          | "PARTIAL_REFUND"
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-semibold text-[#111827]"
                  >
                    <option value="CANCEL">Cancel Entire Bill</option>
                    <option value="FULL_REFUND">Full Refund</option>
                    <option value="PARTIAL_REFUND">
                      Partial Item Refund
                    </option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#111827] block mb-1">
                    Refund Settlement Method
                  </label>
                  <select
                    value={refundMethod}
                    onChange={(e) =>
                      setRefundMethod(
                        e.target.value as
                          | "Cash"
                          | "UPI"
                          | "Other"
                          | "Credit Adjustment"
                          | "None"
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[#111827]"
                  >
                    <option value="Cash">Cash Returned</option>
                    <option value="UPI">UPI Returned</option>
                    <option value="Credit Adjustment">
                      Udhaar / Credit Adjustment
                    </option>
                    <option value="None">None (Unpaid Bill Cancelled)</option>
                  </select>
                </div>
              </div>

              {refundAction === "PARTIAL_REFUND" && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <span className="font-bold text-[#111827] block">
                    Select Quantities to Refund:
                  </span>
                  {refundingSale.items.map((item) => {
                    const maxRefundable =
                      item.quantity - item.refunded_quantity;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-none"
                      >
                        <div>
                          <div className="font-semibold text-[#111827]">
                            {item.product_name_snapshot}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Sold: {item.quantity} • Max Refundable:{" "}
                            {maxRefundable}
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={maxRefundable}
                          value={partialQuantities[item.product_id] || 0}
                          onChange={(e) =>
                            setPartialQuantities((prev) => ({
                              ...prev,
                              [item.product_id]: Math.min(
                                maxRefundable,
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              ),
                            }))
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-center font-bold"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <label className="flex items-center gap-2 font-semibold text-[#111827] cursor-pointer">
                <input
                  type="checkbox"
                  checked={restockItems}
                  onChange={(e) => setRestockItems(e.target.checked)}
                  className="rounded border-gray-300 text-[#2563EB]"
                />
                Automatically restore returned quantities back into available inventory stock
              </label>

              <div>
                <label className="font-semibold text-[#111827] block mb-1">
                  Mandatory Authorization Reason *
                </label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Student changed order / Returned unopened bottle"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundingSale(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-[#111827] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 cursor-pointer"
                >
                  {submitting
                    ? "Processing..."
                    : `Confirm ${refundAction}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
