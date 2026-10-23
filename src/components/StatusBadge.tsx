import React from "react";
import { PaymentStatus, SaleStatus } from "@/types/pos";

export function PaymentStatusBadge({ status }: { status: PaymentStatus | string }) {
  switch (status) {
    case "Paid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Paid
        </span>
      );
    case "Partially Paid":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8] border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
          Partially Paid
        </span>
      );
    case "Pending":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
          Pending (Udhaar)
        </span>
      );
    case "Failed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
          Failed
        </span>
      );
    case "Refunded":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-gray-700 border border-gray-300">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
          {status}
        </span>
      );
  }
}

export function SaleStatusBadge({ status }: { status: SaleStatus | string }) {
  if (status === "Completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
        Completed
      </span>
    );
  }
  if (status === "Partially Refunded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
        Partially Refunded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-gray-700 border border-gray-300">
      {status}
    </span>
  );
}

export function StockStatusBadge({
  quantity,
  minLevel,
}: {
  quantity: number;
  minLevel: number;
}) {
  if (quantity <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        Out of Stock (0)
      </span>
    );
  }
  if (quantity <= minLevel) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
        Low Stock ({quantity})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      In Stock ({quantity})
    </span>
  );
}
