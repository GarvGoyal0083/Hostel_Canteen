import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { notifyCustomerOfOrderStatus } from "@/lib/push/webPush";
import { ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { customer_id, customer_name, bill_number, status_type, custom_message, room_number } = body;

    if (!customer_id) {
      return NextResponse.json(
        { error: "Customer ID is required to send notification." },
        { status: 400 }
      );
    }

    let title = "🍽️ Order Update";
    let messageBody = custom_message;

    if (!messageBody) {
      if (status_type === "READY") {
        title = "🍽️ Order Ready for Pickup!";
        messageBody = `Hey ${customer_name || "Student"}, your order #${bill_number || ""} is freshly prepared and ready at the canteen counter!`;
      } else if (status_type === "OUT_FOR_DELIVERY") {
        title = `🛵 Order Out for Delivery ${room_number ? `to Room ${room_number}` : ""}!`;
        messageBody = `Your canteen order #${bill_number || ""} is on its way to your room right now.`;
      } else if (status_type === "DELIVERED") {
        title = "✅ Order Delivered!";
        messageBody = `Your order #${bill_number || ""} has been completed. Enjoy your snacks!`;
      } else {
        title = "🔔 Hostel Canteen Update";
        messageBody = `Update regarding your order #${bill_number || ""}.`;
      }
    }

    const result = await notifyCustomerOfOrderStatus(
      customer_id,
      title,
      messageBody,
      `/customer?customerId=${encodeURIComponent(customer_id)}`
    );

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      message:
        result.sent > 0
          ? `Notification successfully sent to student (${result.sent} device${result.sent > 1 ? "s" : ""}).`
          : "Notification recorded, but student has not enabled push alerts on their device yet.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
