import { NextRequest, NextResponse } from "next/server";
import { requireExecutiveAuth } from "@/lib/auth";
import {
  DuplicateCustomerError,
  createCustomer,
  ensureDatabaseSync,
} from "@/lib/db/store";

// Sales executives may only register a new student so they can bill them. Everything
// else about students (edit, deactivate, dues, history) stays behind requireAdminAuth.
export async function POST(req: NextRequest) {
  const auth = await requireExecutiveAuth();
  if (!auth.authorized) return auth.response;

  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const room = typeof body.room_number === "string" ? body.room_number.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    }
    if (!room) {
      return NextResponse.json({ error: "Room number is required." }, { status: 400 });
    }

    // Only the whitelisted fields are passed on: no password, notes or status.
    const customer = await createCustomer(
      { name, room_number: room, phone },
      auth.user.full_name,
      { id: auth.user.id, full_name: auth.user.full_name }
    );
    return NextResponse.json(
      {
        student: { id: customer.id, name: customer.name, room_number: customer.room_number },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof DuplicateCustomerError) {
      return NextResponse.json(
        { error: err.message, duplicate: err.existing },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add student." },
      { status: 400 }
    );
  }
}
