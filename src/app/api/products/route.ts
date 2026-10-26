import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createProduct, ensureDatabaseSync, listProducts } from "@/lib/db/store";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  await ensureDatabaseSync();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const category = searchParams.get("category") || undefined;
  const includeInactive = searchParams.get("includeInactive") === "true";

  const products = listProducts({ search, category, includeInactive });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const product = await createProduct(body, auth.admin.full_name);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product." },
      { status: 400 }
    );
  }
}
