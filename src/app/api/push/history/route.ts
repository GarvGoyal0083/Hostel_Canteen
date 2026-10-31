import { NextResponse } from "next/server";
import {
  ensureDatabaseSync,
  listPushNotificationHistory,
  clearPushNotificationHistory,
} from "@/lib/db/store";

export async function GET() {
  try {
    await ensureDatabaseSync();
    const notifications = listPushNotificationHistory(5);
    return NextResponse.json({ notifications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load notification history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearPushNotificationHistory();
    return NextResponse.json({
      success: true,
      notifications: [],
      message: "All notifications cleared.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to clear notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
