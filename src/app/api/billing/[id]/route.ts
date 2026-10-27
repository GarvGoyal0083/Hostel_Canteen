import { NextRequest, NextResponse } from "next/server";
import { requireExecutiveAuth } from "@/lib/auth";
import {
  cancelExecutiveSale,
  editExecutiveSale,
  readDatabase,
  toExecutiveSaleView,
} from "@/lib/db/store";

// Sales executives can edit or cancel only their own bills, and only while unpaid.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireExecutiveAuth();
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await context.params;
    const body = await req.json();

    let sale;
    if (body.action === "cancel") {
      sale = await cancelExecutiveSale(id, String(body.reason || ""), auth.user);
    } else if (body.action === "edit") {
      sale = await editExecutiveSale(
        id,
        {
          customer_id: typeof body.customer_id === "string" ? body.customer_id : undefined,
          items: Array.isArray(body.items) ? body.items : [],
          notes: typeof body.notes === "string" ? body.notes : undefined,
          discount: body.discount,
        },
        auth.user
      );
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    return NextResponse.json({
      sale: toExecutiveSaleView(readDatabase(), sale, auth.user.id),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update bill." },
      { status: 400 }
    );
  }
}
