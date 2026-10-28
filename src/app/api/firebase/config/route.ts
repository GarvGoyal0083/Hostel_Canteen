import { NextResponse } from "next/server";
import { firebaseConfig, isFirebaseConfigured, fcmVapidKey } from "@/lib/firebase/config";

export async function GET() {
  return NextResponse.json({
    configured: isFirebaseConfigured(),
    config: firebaseConfig,
    vapidKey: fcmVapidKey,
  });
}
