import { NextRequest, NextResponse } from "next/server";
import { getCanteenStatus, updateCanteenStatus } from "@/lib/db/store";
import { requireAdminAuth } from "@/lib/auth";

export async function GET() {
  try {
    const status = getCanteenStatus();
    return NextResponse.json({ canteen_status: status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get canteen status." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await req.json();
    const is_open = Boolean(body.is_open);
    const closure_type = body.closure_type || "today";
    const closure_reason = body.closure_reason || "";
    const reopen_at = body.reopen_at || null;

    const updated = await updateCanteenStatus(
      {
        is_open,
        closure_type,
        closure_reason,
        reopen_at,
      },
      auth.admin.full_name
    );

    return NextResponse.json({
      success: true,
      canteen_status: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update status." },
      { status: 400 }
    );
  }
}
