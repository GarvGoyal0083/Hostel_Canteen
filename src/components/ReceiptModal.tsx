"use client";

import React from "react";
import { Printer, Download, X, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { SaleRecord } from "@/types/pos";
import { formatINR, formatIST } from "@/lib/format";
import { PaymentStatusBadge, SaleStatusBadge } from "@/components/StatusBadge";
import { CanteenLogo } from "@/components/CanteenLogo";

/**
 * Generates a clean, standalone, high-resolution HTML invoice/receipt
 * optimized for standard desktop printing, thermal 80mm printers, and PDF export.
 */
function generateReceiptHTML(sale: SaleRecord): string {
  const itemsHtml = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.product_name_snapshot}</div>
          <div style="font-size: 11px; color: #64748b;">SKU: ${item.sku_snapshot}${
        item.refunded_quantity > 0 ? ` &bull; <span style="color:#dc2626;">Refunded: ${item.refunded_quantity}</span>` : ""
      }</div>
        </td>
        <td style="padding: 8px 6px; text-align: center; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${item.quantity}</td>
        <td style="padding: 8px 6px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatINR(item.selling_price_at_sale)}</td>
        <td style="padding: 8px 6px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace; color: #475569;">${
          item.discount_amount > 0 ? `-${formatINR(item.discount_amount)}` : "&mdash;"
        }</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 700; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatINR(item.final_line_total)}</td>
      </tr>
    `
    )
    .join("");

  const paymentsHtml =
    sale.payments.length === 0
      ? `<div style="color: #b45309; font-weight: 600; padding: 6px 0;">No payment received at billing &mdash; Recorded as Pending Customer Udhaar.</div>`
      : sale.payments
          .map(
            (p) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12px;">
          <div>
            <strong>${p.payment_method}</strong>: ${formatINR(p.amount_received)}
            ${p.upi_reference ? `<div style="font-family: monospace; font-size: 11px; color: #1d4ed8;">Ref/UTR: ${p.upi_reference}</div>` : ""}
          </div>
          <div style="color: #64748b; font-size: 11px;">${formatIST(p.payment_date)}</div>
        </div>
      `
          )
          .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt — ${sale.bill_number}</title>
  <style>
    @page {
      size: auto;
      margin: 8mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px 12px;
    }
    .receipt-container {
      max-width: 540px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      padding: 28px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .header {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 2px dashed #cbd5e1;
      margin-bottom: 18px;
    }
    .canteen-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .canteen-sub {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .bill-pill {
      display: inline-block;
      padding: 4px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 800;
      color: #1d4ed8;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      font-size: 12px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 16px;
    }
    .meta-label {
      color: #64748b;
      font-size: 11px;
      display: block;
    }
    .meta-val {
      font-weight: 700;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-paid {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .badge-udhaar {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    .items-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      padding: 6px 6px 8px 6px;
      border-bottom: 2px solid #cbd5e1;
      text-transform: uppercase;
    }
    .totals-box {
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      color: #475569;
    }
    .grand-total-row {
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      padding: 10px 0;
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .payment-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 18px;
    }
    .footer {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      line-height: 1.6;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .receipt-container {
        border: none !important;
        box-shadow: none !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="canteen-title">Hostel Canteen</div>
      <div class="canteen-sub">Room Canteen &bull; Kurkure, Chips, Biscuits, Cold Drinks &amp; Snacks</div>
      <div class="bill-pill">Bill ID: ${sale.bill_number}</div>
    </div>

    <div class="meta-grid">
      <div>
        <span class="meta-label">Customer / Student:</span>
        <span class="meta-val">${sale.customer_name_snapshot}</span>
        ${
          sale.room_number_snapshot
            ? `<span style="margin-left: 4px; padding: 1px 6px; background: #f1f5f9; border-radius: 4px; font-size: 10px; font-weight: 700;">Room ${sale.room_number_snapshot}</span>`
            : ""
        }
      </div>
      <div style="text-align: right;">
        <span class="meta-label">Date &amp; Time (IST):</span>
        <span class="meta-val">${formatIST(sale.created_at, true)}</span>
      </div>
      <div>
        <span class="meta-label">Cashier / Recorded By:</span>
        <span class="meta-val">${sale.created_by}</span>
      </div>
      <div style="text-align: right;">
        <span class="meta-label">Status:</span>
        <span class="badge ${sale.payment_status === "Paid" ? "badge-paid" : "badge-udhaar"}">${sale.payment_status}</span>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Rate</th>
          <th style="text-align: right;">Disc</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span>Original Subtotal:</span>
        <span style="font-family: monospace; font-weight: 600;">${formatINR(sale.subtotal_amount)}</span>
      </div>
      ${
        sale.item_discount_total > 0
          ? `<div class="totals-row" style="color: #2563eb;">
              <span>Item-Level Discounts:</span>
              <span style="font-family: monospace;">-${formatINR(sale.item_discount_total)}</span>
            </div>`
          : ""
      }
      ${
        sale.bill_discount_amount > 0
          ? `<div class="totals-row" style="color: #2563eb;">
              <span>Bill Discount (${sale.discount_reason || "Promotional"}):</span>
              <span style="font-family: monospace;">-${formatINR(sale.bill_discount_amount)}</span>
            </div>`
          : ""
      }
      <div class="grand-total-row">
        <span>FINAL PAYABLE:</span>
        <span style="color: #2563eb; font-family: monospace;">${formatINR(sale.payable_amount)}</span>
      </div>
      <div class="totals-row" style="color: #166534; font-weight: 700;">
        <span>Total Amount Paid:</span>
        <span style="font-family: monospace;">${formatINR(sale.paid_amount)}</span>
      </div>
      <div class="totals-row" style="color: #b45309; font-weight: 700;">
        <span>Remaining Due (Udhaar):</span>
        <span style="font-family: monospace;">${formatINR(sale.outstanding_amount)}</span>
      </div>
    </div>

    <div class="payment-box">
      <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
        Payment Details
      </div>
      ${paymentsHtml}
    </div>

    <div class="footer">
      <div>Thank you for visiting Hostel Canteen! &bull; Visit Again</div>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Computer-Generated POS Receipt &bull; Verification Bill No: ${sale.bill_number}</div>
    </div>
  </div>
</body>
</html>`;
}

export function ReceiptModal({
  sale,
  onClose,
}: {
  sale: SaleRecord | null;
  onClose: () => void;
}) {
  if (!sale) return null;

  /**
   * Print receipt via an isolated hidden iframe
   * Guarantees 100% reliable printing without blank pages, cuts, or modal dark mode artifacts
   */
  const handlePrint = () => {
    const receiptHtml = generateReceiptHTML(sale);

    try {
      let printFrame = document.getElementById("receipt-print-frame") as HTMLIFrameElement;
      if (!printFrame) {
        printFrame = document.createElement("iframe");
        printFrame.id = "receipt-print-frame";
        printFrame.style.position = "fixed";
        printFrame.style.right = "0";
        printFrame.style.bottom = "0";
        printFrame.style.width = "0";
        printFrame.style.height = "0";
        printFrame.style.border = "none";
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(receiptHtml);
        frameDoc.close();

        setTimeout(() => {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        }, 300);
        return;
      }
    } catch (e) {
      console.warn("Iframe print failed, falling back to popup window:", e);
    }

    // Fallback if iframe fails or is blocked
    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  /**
   * Download a complete standalone HTML receipt file
   */
  const handleDownloadHtmlReceipt = () => {
    const html = generateReceiptHTML(sale);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt-${sale.bill_number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Plain text receipt export
   */
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
            {/* Primary Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer active:scale-95"
              title="Print Receipt or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>

            {/* Download HTML Receipt Button */}
            <button
              onClick={handleDownloadHtmlReceipt}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-[#111827] dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Download standalone formatted receipt"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Receipt</span>
            </button>

            {/* Quick .TXT Export */}
            <button
              onClick={handleDownloadTextReceipt}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
              title="Download thermal plain text"
            >
              <Download className="h-3 w-3" />
              <span>.TXT</span>
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
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#EFF6FF] dark:bg-blue-950/40 px-3 py-1 text-xs font-bold text-[#1D4ED8] dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
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
                {formatIST(sale.created_at, true)}
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
