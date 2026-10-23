import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createExpense, listExpenses, voidExpense } from "@/lib/db/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const expenses = listExpenses({
    category: searchParams.get("category") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    includeVoided: searchParams.get("includeVoided") === "true",
  });

  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const expense = await createExpense(body, auth.admin.full_name);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create expense." },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const expense = await voidExpense(
      body.id,
      body.void_reason,
      auth.admin.full_name
    );
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to void expense." },
      { status: 400 }
    );
  }
}
