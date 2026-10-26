import { NextRequest, NextResponse } from "next/server";
import {
  createCustomer,
  ensureDatabaseSync,
  getCanteenStatus,
  getCustomerDetailsWithLedger,
  listCustomers,
  listProducts,
} from "@/lib/db/store";

function normalizePhone(p?: string | null): string {
  if (!p) return "";
  const digits = p.replace(/[^0-9]/g, "");
  // Take last 10 digits for consistent mobile number comparison
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    // Public-safe product catalog (hides private purchase_price & unit profit margin)
    const activeProducts = listProducts({ includeInactive: false }).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      image_url: p.image_url,
      selling_price: p.selling_price,
      stock_quantity: p.stock_quantity,
      min_stock_level: p.min_stock_level,
      expiry_date: p.expiry_date,
      is_active: p.is_active,
    }));

    if (customerId) {
      const details = getCustomerDetailsWithLedger(customerId);
      // Sanitize sale items so internal purchase cost/profit are not exposed to students
      const safeSales = details.sales.map((s) => ({
        ...s,
        cogs_amount: 0,
        estimated_gross_profit: 0,
        items: s.items.map((item) => ({
          ...item,
          purchase_price_at_sale: 0,
          line_cogs: 0,
          line_profit: 0,
        })),
      }));

      return NextResponse.json({
        products: activeProducts,
        customer_profile: details.customer,
        sales: safeSales,
        payments: details.payments,
        ledger: details.ledger,
        canteen_status: getCanteenStatus(),
      });
    }

    return NextResponse.json({
      products: activeProducts,
      canteen_status: getCanteenStatus(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load customer portal data.",
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const action = String(body.action || "login").toLowerCase();
    const name = String(body.name || "").trim();
    const roomNumber = String(body.room_number || "").trim();
    const rawMobile = String(body.password || body.phone || body.mobile || "").trim();
    const mobileDigits = normalizePhone(rawMobile);

    const customers = listCustomers();

    // =========================================================================
    // ACTION: REGISTER NEW STUDENT
    // =========================================================================
    if (action === "register") {
      if (!name) {
        return NextResponse.json(
          { error: "Student full name is required." },
          { status: 400 }
        );
      }
      if (!roomNumber) {
        return NextResponse.json(
          { error: "Hostel room number is required." },
          { status: 400 }
        );
      }
      if (!mobileDigits || mobileDigits.length < 10) {
        return NextResponse.json(
          { error: "A valid 10-digit mobile number is required (this will be your password)." },
          { status: 400 }
        );
      }

      // Check if student with this mobile number already exists
      const existingPhone = customers.find(
        (c) => normalizePhone(c.phone) === mobileDigits
      );
      if (existingPhone) {
        return NextResponse.json(
          {
            error: `An account with this mobile number already exists for "${existingPhone.name}". Please Sign In using your Name and Mobile Number.`,
          },
          { status: 400 }
        );
      }

      // Check if student with same Name + Room already exists
      const existingNameRoom = customers.find(
        (c) =>
          c.name.toLowerCase() === name.toLowerCase() &&
          (c.room_number || "").toLowerCase() === roomNumber.toLowerCase()
      );
      if (existingNameRoom) {
        return NextResponse.json(
          {
            error: `An account for "${name}" in Room ${roomNumber} already exists. Please Sign In with your mobile number.`,
          },
          { status: 400 }
        );
      }

      const createdCustomer = await createCustomer(
        {
          name,
          room_number: roomNumber,
          phone: mobileDigits,
          notes: "Self-registered via Student Portal",
        },
        "Student Self-Portal"
      );

      return NextResponse.json({
        success: true,
        customer: createdCustomer,
        created: true,
      });
    }

    // =========================================================================
    // ACTION: SIGN IN EXISTING STUDENT (Requires Name/Room + Mobile Number Password)
    // =========================================================================
    if (!name && !roomNumber) {
      return NextResponse.json(
        { error: "Please enter your Name or Room Number." },
        { status: 400 }
      );
    }
    if (!mobileDigits || mobileDigits.length < 10) {
      return NextResponse.json(
        { error: "Please enter your 10-digit registered mobile number as your password." },
        { status: 400 }
      );
    }

    // Match student: candidate match by Name or Room, then verify mobile number password
    const candidateMatches = customers.filter((c) => {
      const nameMatch = name && c.name.toLowerCase().includes(name.toLowerCase());
      const roomMatch =
        (roomNumber && (c.room_number || "").toLowerCase() === roomNumber.toLowerCase()) ||
        (name && (c.room_number || "").toLowerCase() === name.toLowerCase());
      return nameMatch || roomMatch;
    });

    const verifiedCustomer =
      candidateMatches.find((c) => normalizePhone(c.phone) === mobileDigits) ||
      customers.find((c) => normalizePhone(c.phone) === mobileDigits);

    if (!verifiedCustomer) {
      return NextResponse.json(
        {
          error:
            "Invalid Name or Mobile Number password. If you are a new student, please click 'Register as New Student'.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: verifiedCustomer,
      created: false,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Student portal authentication failed.",
      },
      { status: 400 }
    );
  }
}
