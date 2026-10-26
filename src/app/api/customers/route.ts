import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  createCustomer,
  ensureDatabaseSync,
  listCustomers,
  recordCustomerDuesRepayment,
} from "@/lib/db/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const customers = listCustomers(search);
  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    if (body.action === "repay_dues") {
      const result = await recordCustomerDuesRepayment(
        {
          customer_id: body.customer_id,
          payment_method: body.payment_method,
          amount_received: body.amount_received,
          upi_reference: body.upi_reference,
          notes: body.notes,
        },
        auth.admin.full_name
      );
      return NextResponse.json(result, { status: 201 });
    }

    const customer = await createCustomer(body, auth.admin.full_name);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to process customer action.",
      },
      { status: 400 }
    );
  }
}
