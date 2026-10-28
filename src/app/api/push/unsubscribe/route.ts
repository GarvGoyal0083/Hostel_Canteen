import { NextRequest, NextResponse } from "next/server";
import { removePushSubscription, ensureDatabaseSync } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSync();
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json(
        { error: "Endpoint string is required to unsubscribe." },
        { status: 400 }
      );
    }

    const removed = await removePushSubscription(endpoint);
    return NextResponse.json({
      success: true,
      removed,
      message: "Push notifications turned off for this device.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
