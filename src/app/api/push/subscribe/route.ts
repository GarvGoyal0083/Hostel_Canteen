import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription, ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { subscription, role, customer_id, user_name } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Invalid subscription payload. Endpoint and keys are required." },
        { status: 400 }
      );
    }

    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json(
        { error: "Invalid subscription keys. p256dh and auth are required." },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;

    const record = await savePushSubscription({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      role: role === "staff" || role === "admin" ? role : "customer",
      customer_id: customer_id || null,
      user_name: user_name || null,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      subscription: record,
      message: "Push notifications successfully enabled on this device.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
