import { SaleRecord } from "@/types/pos";

/**
 * Formatting, Timezone (IST / Asia/Kolkata), and CSV Utilities
 */

export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Round a currency number safely to 2 decimal places
 */
export function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Format amount in Indian Rupees (₹)
 */
export function formatINR(amount: number | undefined | null): string {
  const num = Number(amount ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: safe % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Format timestamp in Indian Standard Time (IST)
 * Example: "24 Oct 2026, 03:45 PM IST"
 */
export function formatIST(
  isoOrDate: string | Date | undefined | null,
  includeSeconds = false
): string {
  if (!isoOrDate) return "—";
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return String(isoOrDate);

  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
  }).format(date);

  return `${formatted} IST`;
}

/**
 * Format date only in IST (e.g. "24 Oct 2026")
 */
export function formatDateIST(isoOrDate: string | Date | undefined | null): string {
  if (!isoOrDate) return "—";
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return String(isoOrDate);

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Return YYYY-MM-DD in Asia/Kolkata timezone for a given Date or ISO string
 */
export function getISTDateString(isoOrDate: string | Date = new Date()): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Return compact YYYYMMDD in Asia/Kolkata timezone for Bill IDs (`HC-YYYYMMDD-NNN`)
 */
export function getISTCompactDateKey(isoOrDate: string | Date = new Date()): string {
  return getISTDateString(isoOrDate).replace(/-/g, "");
}

/**
 * Escape a cell value according to RFC-4180 CSV specifications
 */
export function escapeCSVCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects into RFC-4180 compliant CSV string
 */
export function objectsToCSV(
  rows: Record<string, unknown>[],
  fallbackHeaders?: string[]
): string {
  if (!rows || rows.length === 0) {
    if (fallbackHeaders && fallbackHeaders.length > 0) {
      const headerLine = fallbackHeaders.map(escapeCSVCell).join(",");
      const emptyRow = fallbackHeaders
        .map((_, i) => (i === 0 ? '"No records found"' : '""'))
        .join(",");
      return `${headerLine}\r\n${emptyRow}`;
    }
    return "";
  }
  const headers = Object.keys(rows[0]);

  const lines = [
    headers.map(escapeCSVCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCSVCell(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * Trigger a browser download of a raw CSV string with UTF-8 BOM
 */
export function downloadRawCSV(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of a CSV file from an array of objects
 */
export function downloadCSV(
  filename: string,
  rows: Record<string, unknown>[],
  fallbackHeaders?: string[]
): void {
  if (typeof window === "undefined") return;
  const csvContent = objectsToCSV(rows, fallbackHeaders);
  downloadRawCSV(filename, csvContent);
}

/**
 * Compute active financial metrics of a sale accounting for full or partial refunds
 */
export function getSaleActiveFinancials(s: SaleRecord): {
  activeGross: number;
  activeDiscounts: number;
  activeNet: number;
  activeCogs: number;
  activeProfit: number;
  isFullyRefunded: boolean;
} {
  const isFullyRefunded =
    s.sale_status === "Cancelled" ||
    s.sale_status === "Refunded" ||
    (s.payable_amount > 0 && s.refunded_amount >= s.payable_amount);

  if (isFullyRefunded) {
    return {
      activeGross: 0,
      activeDiscounts: 0,
      activeNet: 0,
      activeCogs: 0,
      activeProfit: 0,
      isFullyRefunded: true,
    };
  }

  if (!s.refunded_amount || s.refunded_amount === 0) {
    const net = round2(s.payable_amount);
    const cogs = round2(s.cogs_amount);
    return {
      activeGross: round2(s.subtotal_amount),
      activeDiscounts: round2(s.total_discount_amount),
      activeNet: net,
      activeCogs: cogs,
      activeProfit: round2(net - cogs),
      isFullyRefunded: false,
    };
  }

  // Partially refunded sale: compute from remaining item quantities
  if (s.items && s.items.length > 0) {
    const billDiscFactor =
      s.subtotal_amount - s.item_discount_total > 0
        ? 1 - s.bill_discount_amount / (s.subtotal_amount - s.item_discount_total)
        : 1;

    let activeGross = 0;
    let activeDiscounts = 0;
    let activeNet = 0;
    let activeCogs = 0;

    for (const item of s.items) {
      const netQty = item.quantity - (item.refunded_quantity || 0);
      if (netQty <= 0) continue;

      const ratio = netQty / item.quantity;
      const itemNetRev = round2(item.final_line_total * ratio * billDiscFactor);
      const itemCogs = round2(item.purchase_price_at_sale * netQty);
      const itemGross = round2(item.original_line_total * ratio);
      const itemDisc = round2(itemGross - itemNetRev);

      activeGross = round2(activeGross + itemGross);
      activeDiscounts = round2(activeDiscounts + itemDisc);
      activeNet = round2(activeNet + itemNetRev);
      activeCogs = round2(activeCogs + itemCogs);
    }

    return {
      activeGross,
      activeDiscounts,
      activeNet,
      activeCogs,
      activeProfit: round2(activeNet - activeCogs),
      isFullyRefunded: false,
    };
  }

  // Fallback ratio if items array not populated
  const activeRatio =
    s.payable_amount > 0
      ? Math.max(0, s.payable_amount - s.refunded_amount) / s.payable_amount
      : 0;

  const activeGross = round2(s.subtotal_amount * activeRatio);
  const activeDiscounts = round2(s.total_discount_amount * activeRatio);
  const activeNet = round2(Math.max(0, s.payable_amount - s.refunded_amount));
  const activeCogs = round2(s.cogs_amount * activeRatio);

  return {
    activeGross,
    activeDiscounts,
    activeNet,
    activeCogs,
    activeProfit: round2(activeNet - activeCogs),
    isFullyRefunded: false,
  };
}
