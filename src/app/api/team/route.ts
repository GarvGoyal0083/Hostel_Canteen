import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  createSalesExecutive,
  ensureDatabaseSync,
  getExecutivePerformance,
  parseExecutivePeriod,
  resetSalesExecutivePassword,
  setCommissionRate,
  setSalesExecutiveActive,
} from "@/lib/db/store";

// Admin only: manage Sales Executives and view their performance.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const period = parseExecutivePeriod(new URL(req.url).searchParams.get("period"));
  return NextResponse.json(getExecutivePerformance(period));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const executive = await createSalesExecutive(
      {
        full_name: String(body.full_name || ""),
        email: String(body.email || ""),
        password: String(body.password || ""),
      },
      auth.admin.full_name
    );
    return NextResponse.json({ executive }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add Sales Executive." },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    if (body.action === "reset_password") {
      await resetSalesExecutivePassword(
        String(body.id || ""),
        String(body.password || ""),
        auth.admin.full_name
      );
      return NextResponse.json({ success: true });
    }
    if (body.action === "set_active") {
      const executive = await setSalesExecutiveActive(
        String(body.id || ""),
        Boolean(body.is_active),
        auth.admin.full_name
      );
      return NextResponse.json({ executive });
    }
    if (body.action === "set_commission_rate") {
      const rate = await setCommissionRate(Number(body.rate), auth.admin.full_name);
      return NextResponse.json({ commission_rate_percent: rate });
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Team action failed." },
      { status: 400 }
    );
  }
}
