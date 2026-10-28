import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription, ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { token, customer_id, customer_name } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "FCM token string is required." }, { status: 400 });
    }

    // Save FCM registration token in the application store using an FCM endpoint identifier
    await savePushSubscription({
      endpoint: `fcm:${token}`,
      keys: {
        p256dh: "fcm",
        auth: "fcm",
      },
      role: "customer",
      customer_id: customer_id || null,
      user_name: customer_name || null,
      user_agent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "FCM device registration token registered successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
