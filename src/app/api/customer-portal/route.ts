import { NextRequest, NextResponse } from "next/server";
import {
  createCustomer,
  getCustomerDetailsWithLedger,
  listCustomers,
  listProducts,
} from "@/lib/db/store";

export async function GET(req: NextRequest) {
  try {
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

    const allCustomers = listCustomers().map((c) => ({
      id: c.id,
      name: c.name,
      room_number: c.room_number,
      outstanding_dues: c.outstanding_dues,
      total_purchases: c.total_purchases,
      total_payments: c.total_payments,
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
        customers: allCustomers,
        customer_profile: details.customer,
        sales: safeSales,
        payments: details.payments,
        ledger: details.ledger,
      });
    }

    return NextResponse.json({
      products: activeProducts,
      customers: allCustomers,
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
    const body = await req.json();
    const customerId = (body.customerId || "").trim();
    const name = (body.name || "").trim();
    const roomNumber = (body.room_number || "").trim();
    const phone = (body.phone || "").trim();

    const customers = listCustomers();

    // 1. Direct login by customerId
    if (customerId) {
      const found = customers.find((c) => c.id === customerId);
      if (!found) {
        return NextResponse.json(
          { error: "Student profile not found." },
          { status: 404 }
        );
      }
      return NextResponse.json({ customer: found });
    }

    // 2. Login or self-register by Name + Room Number
    if (!name) {
      return NextResponse.json(
        { error: "Please enter your name or select your room profile." },
        { status: 400 }
      );
    }

    const existing = customers.find((c) => {
      const nameMatch = c.name.toLowerCase() === name.toLowerCase();
      if (!roomNumber) return nameMatch;
      const roomMatch =
        (c.room_number || "").toLowerCase() === roomNumber.toLowerCase();
      return nameMatch && roomMatch;
    }) || customers.find((c) => c.name.toLowerCase() === name.toLowerCase());

    if (existing) {
      return NextResponse.json({ customer: existing, created: false });
    }

    // Create new hostel student customer account
    const createdCustomer = await createCustomer(
      {
        name,
        room_number: roomNumber || undefined,
        phone: phone || undefined,
        notes: "Self-registered via Student Canteen Portal",
      },
      "Student Self-Portal"
    );

    return NextResponse.json({ customer: createdCustomer, created: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Customer portal login failed.",
      },
      { status: 400 }
    );
  }
}
