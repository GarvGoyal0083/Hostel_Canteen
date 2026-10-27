import { NextRequest, NextResponse } from "next/server";
import { requireBillingAuth, requireExecutiveAuth } from "@/lib/auth";
import {
  createExecutiveSale,
  ensureDatabaseSync,
  getCanteenStatus,
  listCustomersForBilling,
  listProductsForBilling,
  readDatabase,
  toExecutiveSaleView,
} from "@/lib/db/store";

// Products (selling price + stock only, never cost) and students for the billing screen.
export async function GET() {
  const auth = await requireBillingAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  return NextResponse.json({
    products: listProductsForBilling(),
    customers: listCustomersForBilling(),
    canteen_status: getCanteenStatus(),
  });
}

// Sales executives create a bill and assign it to a student (goes to their dues).
export async function POST(req: NextRequest) {
  const auth = await requireExecutiveAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const sale = await createExecutiveSale(
      {
        idempotency_key:
          typeof body.idempotency_key === "string" ? body.idempotency_key : undefined,
        customer_id: String(body.customer_id || ""),
        items: Array.isArray(body.items) ? body.items : [],
        notes: typeof body.notes === "string" ? body.notes : undefined,
        discount: body.discount,
      },
      auth.user
    );
    return NextResponse.json(
      { sale: toExecutiveSaleView(readDatabase(), sale, auth.user.id) },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create bill." },
      { status: 400 }
    );
  }
}
