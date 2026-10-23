import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { correctPaymentRecord } from "@/lib/db/store";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const payment = await correctPaymentRecord(id, body, auth.admin.full_name);
    return NextResponse.json({ payment });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to correct payment record.",
      },
      { status: 400 }
    );
  }
}
