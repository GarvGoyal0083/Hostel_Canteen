import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  checkDuplicateUpiReference,
  listPayments,
  recordManualPaymentForBill,
} from "@/lib/db/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const checkUpiRef = searchParams.get("checkUpiRef");
  if (checkUpiRef !== null) {
    const excludeId = searchParams.get("excludePaymentId") || undefined;
    const dup = checkDuplicateUpiReference(checkUpiRef, excludeId);
    return NextResponse.json(dup);
  }

  const payments = listPayments({
    search: searchParams.get("search") || undefined,
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    paymentStatus: searchParams.get("paymentStatus") || undefined,
    duplicateOnly: searchParams.get("duplicateOnly") === "true",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  });

  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const result = await recordManualPaymentForBill(body, auth.admin.full_name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to record manual payment.",
      },
      { status: 400 }
    );
  }
}
