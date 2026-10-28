"use client";

import React from "react";
import { Printer, Download, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SaleRecord } from "@/types/pos";
import { formatINR, formatIST } from "@/lib/format";
import { PaymentStatusBadge, SaleStatusBadge } from "@/components/StatusBadge";
import { CanteenLogo } from "@/components/CanteenLogo";

export function ReceiptModal({
  sale,
  onClose,
}: {
  sale: SaleRecord | null;
  onClose: () => void;
}) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTextReceipt = () => {
    const lines = [
      "================================================",
      "               HOSTEL CANTEEN POS               ",
      "        Snacks, Cold Drinks & Late-Night        ",
      "================================================",
      `Bill ID       : ${sale.bill_number}`,
      `Date & Time   : ${formatIST(sale.created_at, true)}`,
      `Customer      : ${sale.customer_name_snapshot}${sale.room_number_snapshot ? ` (Room: ${sale.room_number_snapshot})` : ""}`,
      `Recorded By   : ${sale.created_by}`,
      `Sale Status   : ${sale.sale_status}`,
      `Payment Status: ${sale.payment_status}`,
      "------------------------------------------------",
      "ITEM                          QTY     TOTAL (INR)",
      "------------------------------------------------",
      ...sale.items.map((item) => {
        const nameCol = item.product_name_snapshot.slice(0, 26).padEnd(28, " ");
        const qtyCol = String(item.quantity).padStart(3, " ");
        const totalCol = formatINR(item.final_line_total).padStart(14, " ");
        const discLine =
          item.discount_amount > 0
            ? `\n  (Orig: ${formatINR(item.original_line_total)}, Item Disc: -${formatINR(item.discount_amount)})`
            : "";
        return `${nameCol} ${qtyCol} ${totalCol}${discLine}`;
      }),
      "------------------------------------------------",
      `Original Subtotal : ${formatINR(sale.subtotal_amount)}`,
      ...(sale.item_discount_total > 0
        ? [`Item Discounts    : -${formatINR(sale.item_discount_total)}`]
        : []),
      ...(sale.bill_discount_amount > 0
        ? [
            `Bill Discount     : -${formatINR(sale.bill_discount_amount)} (${sale.discount_reason || "Authorized"})`,
          ]
        : []),
      `FINAL PAYABLE     : ${formatINR(sale.payable_amount)}`,
      ...(sale.refunded_amount > 0
        ? [`Refunded/Cancelled: -${formatINR(sale.refunded_amount)}`]
        : []),
      `Amount Paid       : ${formatINR(sale.paid_amount)}`,
      `Remaining Due     : ${formatINR(sale.outstanding_amount)}`,
      "------------------------------------------------",
      "MANUAL PAYMENT ENTRIES (Not Gateway Verified):",
      ...(sale.payments.length === 0
        ? ["  No payments recorded yet (Full Udhaar / Pending)"]
        : sale.payments.map(
            (p) =>
              `  - ${p.payment_method}: ${formatINR(p.amount_received)}${p.upi_reference ? ` [UTR/Ref: ${p.upi_reference}]` : ""} (${p.payment_status}) on ${formatIST(p.payment_date)}`
          )),
      "================================================",
      "     Thank you! Visit Hostel Canteen again.     ",
      "================================================",
    ];

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt-${sale.bill_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl overflow-hidden my-8">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-[#F3F4F6] dark:bg-slate-800/90 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#2563EB] dark:text-blue-400" />
            <h3 className="text-base font-bold text-[#111827] dark:text-white">
              Bill Receipt — {sale.bill_number}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              onClick={handleDownloadTextReceipt}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#111827] dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download .TXT
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-[#111827] dark:hover:text-white transition cursor-pointer"
              aria-label="Close receipt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Content */}
        <div id="printable-receipt" className="p-6 bg-white dark:bg-slate-900 text-[#111827] dark:text-slate-100 space-y-4">
          <div className="text-center border-b border-dashed border-gray-300 dark:border-slate-700 pb-4">
            <CanteenLogo className="h-10 w-10 mx-auto mb-2" size={40} />
            <h2 className="text-xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              HOSTEL CANTEEN POS
            </h2>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              Room Canteen — Kurkure, Chips, Biscuits, Cold Drinks & Snacks
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#EFF6FF] dark:bg-blue-950/40 px-3 py-1 text-xs font-bold text-[#1D4ED8] dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Bill ID: {sale.bill_number}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-b border-gray-200 dark:border-slate-700 pb-3">
            <div>
              <span className="text-gray-500 dark:text-slate-400 block">Customer:</span>
              <span className="font-semibold text-[#111827] dark:text-white">
                {sale.customer_name_snapshot}
              </span>
              {sale.room_number_snapshot && (
                <span className="ml-1.5 rounded bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-gray-800 dark:text-slate-200 border border-transparent dark:border-slate-700">
                  Room {sale.room_number_snapshot}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-gray-500 dark:text-slate-400 block">Sale Date & Time (IST):</span>
              <span className="font-semibold text-[#111827] dark:text-slate-200">
                {formatIST(sale.created_at)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-slate-400 block">Admin / Cashier:</span>
              <span className="font-medium text-[#111827] dark:text-slate-300">{sale.created_by}</span>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <SaleStatusBadge status={sale.sale_status} />
                <PaymentStatusBadge status={sale.payment_status} />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-gray-500 dark:text-slate-400">
                  <th className="pb-2 font-semibold">Item</th>
                  <th className="pb-2 text-center font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Rate</th>
                  <th className="pb-2 text-right font-semibold">Disc</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-2">
                      <div className="font-semibold text-[#111827] dark:text-white">
                        {item.product_name_snapshot}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-slate-400">
                        SKU: {item.sku_snapshot}
                        {item.refunded_quantity > 0 && (
                          <span className="ml-1.5 text-red-600 dark:text-red-400 font-semibold">
                            (Refunded: {item.refunded_quantity})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-center font-medium text-slate-800 dark:text-slate-200">
                      {item.quantity}
                    </td>
                    <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(item.selling_price_at_sale)}
                    </td>
                    <td className="py-2 text-right text-gray-600 dark:text-slate-400">
                      {item.discount_amount > 0
                        ? `-${formatINR(item.discount_amount)}`
                        : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold text-[#111827] dark:text-slate-100">
                      {formatINR(item.final_line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-slate-400">
              <span>Original Subtotal:</span>
              <span className="font-medium text-[#111827] dark:text-slate-200">
                {formatINR(sale.subtotal_amount)}
              </span>
            </div>
            {sale.item_discount_total > 0 && (
              <div className="flex justify-between text-blue-700 dark:text-blue-400">
                <span>Item-Level Discounts:</span>
                <span>-{formatINR(sale.item_discount_total)}</span>
              </div>
            )}
            {sale.bill_discount_amount > 0 && (
              <div className="flex justify-between text-blue-700 dark:text-blue-400">
                <span>
                  Bill Discount (
                  {sale.bill_discount_type === "percentage"
                    ? `${sale.bill_discount_value}%`
                    : "Fixed"}
                  {sale.discount_reason ? ` — ${sale.discount_reason}` : ""}):
                </span>
                <span>-{formatINR(sale.bill_discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-[#111827] dark:text-white border-t border-gray-200 dark:border-slate-700 pt-2">
              <span>Final Payable Amount:</span>
              <span className="text-[#2563EB] dark:text-blue-400 font-extrabold">
                {formatINR(sale.payable_amount)}
              </span>
            </div>
            {sale.refunded_amount > 0 && (
              <div className="flex justify-between text-red-700 dark:text-red-400 font-medium">
                <span>Refunded / Cancelled Value:</span>
                <span>-{formatINR(sale.refunded_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
              <span>Total Amount Received:</span>
              <span>{formatINR(sale.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-bold text-amber-800 dark:text-amber-400">
              <span>Remaining Balance (Udhaar):</span>
              <span>{formatINR(sale.outstanding_amount)}</span>
            </div>
          </div>

          {/* Manual Payment Log */}
          <div className="rounded-lg bg-[#F3F4F6] dark:bg-slate-800/60 p-3 text-xs space-y-2 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#111827] dark:text-white">
                Recorded Payment Entries
              </span>
              <span className="text-[11px] text-gray-600 dark:text-slate-400">
                Manual Entry (Not Gateway Verified)
              </span>
            </div>
            {sale.payments.length === 0 ? (
              <p className="text-amber-800 dark:text-amber-400 font-medium">
                No payment received at billing — recorded as Pending Customer Udhaar.
              </p>
            ) : (
              <div className="space-y-1.5">
                {sale.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col rounded bg-white dark:bg-slate-900 p-2 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {p.payment_method} — {formatINR(p.amount_received)}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        {formatIST(p.payment_date)}
                      </span>
                    </div>
                    {p.upi_reference && (
                      <div className="text-[11px] text-[#1D4ED8] dark:text-blue-400 font-mono mt-0.5">
                        Manual UPI Ref / UTR: {p.upi_reference}
                      </div>
                    )}
                    {p.is_duplicate_upi_warning && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        Duplicate UPI Reference Warning — Requires Admin Review
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
