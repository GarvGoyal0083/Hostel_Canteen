import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { cancelOrRefundSale, listSales } from "@/lib/db/store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const sales = listSales();
  const sale = sales.find((s) => s.id === id || s.bill_number === id);
  if (!sale) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }
  return NextResponse.json({ sale });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const sale = await cancelOrRefundSale(id, body, auth.admin.full_name);
    return NextResponse.json({ sale });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to process refund or cancellation.",
      },
      { status: 400 }
    );
  }
}
