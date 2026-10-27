import { NextRequest, NextResponse } from "next/server";
import { requireExecutiveAuth } from "@/lib/auth";
import {
  ensureDatabaseSync,
  getExecutiveMySales,
  parseExecutivePeriod,
} from "@/lib/db/store";

// A sales executive's own bills and commission. Never exposes cost or profit.
export async function GET(req: NextRequest) {
  const auth = await requireExecutiveAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const period = parseExecutivePeriod(new URL(req.url).searchParams.get("period"));
  return NextResponse.json(getExecutiveMySales(auth.user, period));
}
