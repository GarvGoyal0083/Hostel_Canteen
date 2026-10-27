import { NextRequest, NextResponse } from "next/server";
import { requireExecutiveAuth } from "@/lib/auth";
import { ensureDatabaseSync, getExecutiveDiscountMax } from "@/lib/db/store";

// Returns only the largest discount allowed for this cart. The save endpoints
// recalculate and enforce the limit again, so this is purely for the form.
export async function POST(req: NextRequest) {
  const auth = await requireExecutiveAuth();
  if (!auth.authorized) return auth.response;

  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const max_discount = getExecutiveDiscountMax(
      items,
      typeof body.sale_id === "string" ? body.sale_id : undefined
    );
    return NextResponse.json({ max_discount });
  } catch {
    return NextResponse.json({ error: "Could not check the discount." }, { status: 400 });
  }
}
