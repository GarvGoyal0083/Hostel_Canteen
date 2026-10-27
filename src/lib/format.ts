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
