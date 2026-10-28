import webpush from "web-push";
import {
  listPushSubscriptions,
  cleanupExpiredPushSubscriptions,
} from "@/lib/db/store";
import {
  PushNotificationPayload,
  PushSubscriptionRecord,
  SaleRecord,
} from "@/types/pos";

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BG20jTR8VZqmaRh_mU4yTbFXzs9KdfCSKSq4SzogIE95l1H-B17AfBbXvZHhWPSjps1kUKUawwnXdLIfNdKQNCU";

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "VaxmpNiKt6ZwWuBWt_J3z0DQK_2OMk8YUlFwtZ4BLXA";

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:admin@hostelcanteen.local";

let isVapidInitialized = false;

function ensureVapidConfigured() {
  if (isVapidInitialized) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isVapidInitialized = true;
  } catch (err) {
    console.error("[web-push] Failed to configure VAPID credentials:", err);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Sends a web push notification to a single PushSubscriptionRecord.
 * If the subscription is expired or unregistered (410 Gone / 404 Not Found),
 * marks the endpoint for cleanup.
 */
export async function sendPushToSubscription(
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  ensureVapidConfigured();

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };

  const notificationBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/logo.svg",
    badge: payload.badge || "/logo.svg",
    url: payload.url || "/",
    tag: payload.tag || "hostel-canteen-alert",
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
  });

  try {
    const response = await webpush.sendNotification(
      pushSubscription,
      notificationBody,
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: "high",
      }
    );
    return { success: true, statusCode: response.statusCode };
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    const statusCode = error.statusCode;

    // 410 Gone or 404 Not Found means the user revoked permission or the browser subscription expired
    if (statusCode === 410 || statusCode === 404) {
      cleanupExpiredPushSubscriptions([subscription.endpoint]).catch(() => undefined);
    }

    return {
      success: false,
      statusCode,
      error: error.message || "Failed to deliver push notification",
    };
  }
}

/**
 * Sends a notification in parallel to a list of subscriptions, handling errors and expired tokens.
 */
export async function sendPushToSubscribers(
  subscriptions: PushSubscriptionRecord[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub, payload))
  );

  let sent = 0;
  let failed = 0;

  for (const res of results) {
    if (res.status === "fulfilled" && res.value.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Triggered when a student places a new order on the Student Self-Portal.
 * Sends an urgent notification to all registered Canteen Staff & Admins.
 */
export async function notifyStaffOfNewOrder(
  sale: SaleRecord
): Promise<{ sent: number; failed: number }> {
  const staffSubscriptions = listPushSubscriptions({ role: "staff" });
  if (staffSubscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const isRoomDelivery = Boolean(sale.room_number_snapshot);
  const locationText = isRoomDelivery
    ? `Room ${sale.room_number_snapshot} Delivery`
    : `Self-Pickup`;

  const itemsSummary =
    sale.items
      .slice(0, 3)
      .map((i) => `${i.quantity}x ${i.product_name_snapshot}`)
      .join(", ") + (sale.items.length > 3 ? ` +${sale.items.length - 3} more` : "");

  return sendPushToSubscribers(staffSubscriptions, {
    title: `🔔 New Order: ${locationText}!`,
    body: `Bill #${sale.bill_number} • ₹${sale.payable_amount} • ${sale.customer_name_snapshot} (${itemsSummary})`,
    url: "/?tab=transactions",
    tag: `new-order-${sale.id}`,
    data: {
      saleId: sale.id,
      billNumber: sale.bill_number,
      url: "/?tab=transactions",
    },
  });
}

/**
 * Triggered when Canteen Staff updates the status of an order
 * (e.g., "Accepted", "Ready for Pickup", "Out for Delivery", "Delivered").
 */
export async function notifyCustomerOfOrderStatus(
  customerId: string,
  title: string,
  body: string,
  url = "/customer"
): Promise<{ sent: number; failed: number }> {
  const studentSubscriptions = listPushSubscriptions({
    role: "customer",
    customer_id: customerId,
  });

  if (studentSubscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  return sendPushToSubscribers(studentSubscriptions, {
    title,
    body,
    url,
    tag: `customer-order-${Date.now()}`,
    data: {
      customerId,
      url,
    },
  });
}

/**
 * Broadcast an announcement from the Canteen Admin to all subscribed devices.
 */
export async function broadcastPushToAll(
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  const allSubscriptions = listPushSubscriptions();
  return sendPushToSubscribers(allSubscriptions, payload);
}
