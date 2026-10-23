import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { updateProduct } from "@/lib/db/store";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const product = await updateProduct(id, body, auth.admin.full_name);
    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update product." },
      { status: 400 }
    );
  }
}
