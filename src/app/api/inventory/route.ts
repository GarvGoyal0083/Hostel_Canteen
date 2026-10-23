import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  getProductStockSummaries,
  listInventoryMovements,
  recordStockMovement,
} from "@/lib/db/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const product_id = searchParams.get("product_id") || undefined;
  const movement_type = searchParams.get("movement_type") || undefined;
  const search = searchParams.get("search") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const movements = listInventoryMovements({
    product_id,
    movement_type,
    search,
    startDate,
    endDate,
  });
  const summaries = getProductStockSummaries();

  return NextResponse.json({ movements, summaries });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const result = await recordStockMovement(body, auth.admin.full_name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to record inventory movement.",
      },
      { status: 400 }
    );
  }
}
