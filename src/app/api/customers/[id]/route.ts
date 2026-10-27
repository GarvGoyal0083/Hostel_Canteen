import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getCustomerDetailsWithLedger, updateCustomer } from "@/lib/db/store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const details = getCustomerDetailsWithLedger(id);
    return NextResponse.json(details);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Customer not found." },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const customer = await updateCustomer(id, body, auth.admin.full_name);
    return NextResponse.json({ customer });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update customer." },
      { status: 400 }
    );
  }
}

// Customers are never hard-deleted. The admin guard runs first so a sales executive
// gets a 403 here, and an admin gets an explicit 405 instead of a silent no-op.
export async function DELETE() {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;
  return NextResponse.json(
    { error: "Customers cannot be deleted. Deactivate the student instead." },
    { status: 405 }
  );
}
