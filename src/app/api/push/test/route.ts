import { NextRequest, NextResponse } from "next/server";
import { sendPushToSubscription } from "@/lib/push/webPush";
import { ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Valid subscription object required for test notification." },
        { status: 400 }
      );
    }

    const result = await sendPushToSubscription(
      {
        id: "test",
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        role: "staff",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        title: "🔔 Hostel Canteen Alert Test",
        body: "Web Push Notifications are working perfectly! You will receive live alerts for orders.",
        icon: "/logo.svg",
        badge: "/logo.svg",
        url: "/",
        tag: `test-${Date.now()}`,
      }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Test push notification delivered successfully!",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to deliver test notification.",
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
