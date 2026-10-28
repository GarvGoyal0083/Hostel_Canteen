import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { broadcastPushToAll } from "@/lib/push/webPush";
import { ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { title, message, url } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required for broadcast announcement." },
        { status: 400 }
      );
    }

    const result = await broadcastPushToAll({
      title: `📢 ${title}`,
      body: message,
      url: url || "/customer",
      tag: `broadcast-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      message: `Broadcast delivered to ${result.sent} subscribed devices.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
