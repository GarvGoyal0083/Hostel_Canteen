import { NextRequest, NextResponse } from "next/server";
import {
  createCustomer,
  createSaleTransaction,
  DELIVERY_PRODUCT_ID,
  ensureDatabaseSync,
  getCanteenStatus,
  getCustomerDetailsWithLedger,
  listCustomers,
  listProducts,
} from "@/lib/db/store";
import { PaymentMethod, PaymentStatus } from "@/types/pos";

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
    const activeProducts = listProducts({ includeInactive: false })
      .filter((p) => p.id !== DELIVERY_PRODUCT_ID)
      .map((p) => ({
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
    const phone = String(body.phone || body.mobile || "").trim();
    const password = String(body.password || "").trim();
    const mobileDigits = normalizePhone(phone);

    const customers = listCustomers();

    // =========================================================================
    // ACTION: PLACE STUDENT ORDER (Self-Service with Room Delivery option)
    // =========================================================================
    if (action === "order") {
      const customerId = String(body.customer_id || "").trim();
      const items = Array.isArray(body.items) ? body.items : [];
      const roomDelivery = Boolean(body.room_delivery);
      const deliveryRoom = String(body.room_number || "").trim();
      const deliveryNotes = String(body.notes || "").trim();
      const paymentMethod = String(body.payment_method || "Unpaid");
      const upiRef = String(body.upi_reference || "").trim();

      if (!customerId) {
        return NextResponse.json(
          { error: "Please log in with your name or room to place an order." },
          { status: 401 }
        );
      }

      if (!items || items.length === 0) {
        return NextResponse.json(
          { error: "Your cart is empty. Please add snacks to place an order." },
          { status: 400 }
        );
      }

      if (roomDelivery && !deliveryRoom) {
        return NextResponse.json(
          { error: "Please provide your hostel room number for room delivery." },
          { status: 400 }
        );
      }

      const canteenStatus = getCanteenStatus();
      if (!canteenStatus.is_open) {
        return NextResponse.json(
          {
            error: `Canteen is currently closed (${canteenStatus.closure_reason || "Not accepting orders right now"}). Orders cannot be placed at this time.`,
          },
          { status: 400 }
        );
      }

      const saleItems = items.map(
        (i: { product_id: string; quantity: number }) => ({
          product_id: i.product_id,
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
        })
      );

      if (roomDelivery) {
        saleItems.push({
          product_id: DELIVERY_PRODUCT_ID,
          quantity: 1,
        });
      }

      // Calculate total payable
      const dbProducts = listProducts({ includeInactive: false });
      let itemsTotal = 0;
      for (const reqItem of items) {
        const prod = dbProducts.find((p) => p.id === reqItem.product_id);
        if (prod) {
          itemsTotal +=
            prod.selling_price *
            Math.max(1, Math.floor(Number(reqItem.quantity) || 1));
        }
      }
      const deliveryFee = roomDelivery ? 20 : 0;
      const totalAmount = itemsTotal + deliveryFee;

      let paymentRecord: Array<{
        payment_method: PaymentMethod;
        amount_received: number;
        upi_reference?: string;
        payment_status?: PaymentStatus;
        notes?: string;
      }> = [];

      if (paymentMethod === "UPI") {
        paymentRecord = [
          {
            payment_method: "UPI",
            amount_received: totalAmount,
            upi_reference: upiRef || undefined,
            payment_status: "Paid",
            notes: "UPI payment via Student Portal",
          },
        ];
      } else if (paymentMethod === "Cash") {
        paymentRecord = [
          {
            payment_method: "Cash",
            amount_received: 0,
            payment_status: "Pending",
            notes: "Cash on delivery / pay at room",
          },
        ];
      } else {
        paymentRecord = [
          {
            payment_method: "Other",
            amount_received: 0,
            payment_status: "Pending",
            notes: "Charged to Student Room Udhaar Account",
          },
        ];
      }

      const saleNotes = [
        roomDelivery
          ? `[ROOM DELIVERY: Room ${deliveryRoom}]`
          : `[SELF PICKUP AT CANTEEN]`,
        deliveryNotes ? `Note: ${deliveryNotes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const { sale } = await createSaleTransaction(
        {
          customer_id: customerId,
          items: saleItems,
          payments: paymentRecord,
          notes: saleNotes,
        },
        "Student Self-Portal",
        { id: "customer-portal" }
      );

      return NextResponse.json({
        success: true,
        sale,
        message: roomDelivery
          ? `Order placed successfully! Delivery to Room ${deliveryRoom} will arrive shortly.`
          : `Order placed successfully! Your snacks are ready for pickup at the canteen.`,
      });
    }

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
      if (phone && mobileDigits.length > 0 && mobileDigits.length < 10) {
        return NextResponse.json(
          { error: "If providing a mobile number, please enter a valid 10-digit number." },
          { status: 400 }
        );
      }
      if (!password || password.length < 3) {
        return NextResponse.json(
          { error: "Please create a custom password (at least 3 characters)." },
          { status: 400 }
        );
      }

      // Check if student with this mobile number already exists (if provided)
      if (mobileDigits && mobileDigits.length >= 10) {
        const existingPhone = customers.find(
          (c) => normalizePhone(c.phone) === mobileDigits
        );
        if (existingPhone) {
          return NextResponse.json(
            {
              error: `An account with this mobile number already exists for "${existingPhone.name}". Please Sign In using your Name and Password.`,
            },
            { status: 400 }
          );
        }
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
            error: `An account for "${name}" in Room ${roomNumber} already exists. Please Sign In with your password.`,
          },
          { status: 400 }
        );
      }

      const createdCustomer = await createCustomer(
        {
          name,
          room_number: roomNumber,
          phone: mobileDigits && mobileDigits.length >= 10 ? mobileDigits : undefined,
          password: password,
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
    // ACTION: SIGN IN EXISTING STUDENT (Requires Name/Room + Custom Password)
    // =========================================================================
    if (!name && !roomNumber) {
      return NextResponse.json(
        { error: "Please enter your Name or Room Number." },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Please enter your password." },
        { status: 400 }
      );
    }

    // Match student: candidate match by Name or Room, then verify custom password
    const candidateMatches = customers.filter((c) => {
      const nameMatch = name && c.name.toLowerCase().includes(name.toLowerCase());
      const roomMatch =
        (roomNumber && (c.room_number || "").toLowerCase() === roomNumber.toLowerCase()) ||
        (name && (c.room_number || "").toLowerCase() === name.toLowerCase());
      return nameMatch || roomMatch;
    });

    const isPasswordMatch = (c: typeof customers[0]) => {
      // 1. Primary check: Custom password match
      if (c.password && c.password.trim() === password) return true;
      // 2. Legacy fallback: if customer was created prior to custom passwords
      if (!c.password && c.phone && normalizePhone(c.phone) === normalizePhone(password)) {
        return true;
      }
      return false;
    };

    const verifiedCustomer =
      candidateMatches.find(isPasswordMatch) ||
      customers.find(isPasswordMatch);

    if (!verifiedCustomer) {
      return NextResponse.json(
        {
          error:
            "Invalid Name or Password. Please check your password or register if you are a new student.",
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
