import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createSaleTransaction, ensureDatabaseSync, listSales } from "@/lib/db/store";
import { notifyCustomerOfOrderPlaced } from "@/lib/push/webPush";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const { searchParams } = new URL(req.url);
  const sales = listSales({
    billId: searchParams.get("billId") || undefined,
    customerName: searchParams.get("customerName") || undefined,
    roomNumber: searchParams.get("roomNumber") || undefined,
    productName: searchParams.get("productName") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    paymentMethod: searchParams.get("paymentMethod") || undefined,
    paymentStatus: searchParams.get("paymentStatus") || undefined,
    upiReference: searchParams.get("upiReference") || undefined,
    search: searchParams.get("search") || undefined,
    sortBy:
      (searchParams.get("sortBy") as
        | "newest"
        | "oldest"
        | "highest"
        | "lowest") || "newest",
  });

  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const result = await createSaleTransaction(body, auth.admin.full_name, {
      id: auth.admin.id,
    });

    if (result.sale.customer_id) {
      notifyCustomerOfOrderPlaced(result.sale).catch((err) =>
        console.warn("[push] Failed to notify student of counter purchase:", err)
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to complete sale." },
      { status: 400 }
    );
  }
}
