"use client";

import { useState, useEffect, useCallback } from "react";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface UsePushNotificationsOptions {
  role?: "staff" | "customer" | "admin";
  customerId?: string | null;
  userName?: string | null;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { role = "customer", customerId, userName } = options;

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isIosWithoutPwa, setIsIosWithoutPwa] = useState<boolean>(false);

  // Check support & detect iOS Safari standalone requirement
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasServiceWorker = "serviceWorker" in navigator;
    const hasPushManager = "PushManager" in window;
    const hasNotification = "Notification" in window;

    const supported = hasServiceWorker && hasPushManager && hasNotification;
    setIsSupported(supported);

    if (hasNotification) {
      setPermission(Notification.permission);
    }

    // Detect iOS (where Web Push requires "Add to Home Screen" PWA)
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIos && !isStandalone) {
      setIsIosWithoutPwa(true);
    }

    // Auto-register service worker and sync subscription whenever supported
    if (supported) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(async (reg) => {
          let sub = await reg.pushManager.getSubscription();

          if (Notification.permission === "granted") {
            if (!sub) {
              try {
                const keyRes = await fetch("/api/push/vapid-public-key");
                if (keyRes.ok) {
                  const { publicKey } = await keyRes.json();
                  const appKey = urlBase64ToUint8Array(publicKey);
                  sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: appKey as unknown as BufferSource,
                  });
                }
              } catch (e) {
                console.warn("[push] Auto-subscribe error:", e);
              }
            }

            if (sub) {
              setIsSubscribed(true);
              // Always auto-sync subscription with server so database has this device + customer_id + role
              await fetch("/api/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscription: sub.toJSON(),
                  role,
                  customer_id: customerId || null,
                  user_name: userName || null,
                }),
              }).catch(() => undefined);
            }
          } else {
            setIsSubscribed(Boolean(sub));
          }
        })
        .catch((err) => console.warn("[push] SW registration error:", err));
    }
  }, [role, customerId, userName]);

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError("Push notifications are not supported on this browser.");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request Permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setError("Notification permission was not granted.");
        return false;
      }

      // 2. Fetch VAPID public key
      const keyRes = await fetch("/api/push/vapid-public-key");
      if (!keyRes.ok) {
        throw new Error("Failed to retrieve push server public key.");
      }
      const { publicKey } = await keyRes.json();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 3. Register Service Worker if needed
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;

      // 4. Subscribe with PushManager
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });
      }

      // 5. Send subscription to server
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          role,
          customer_id: customerId || null,
          user_name: userName || null,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save push subscription on server.");
      }

      setIsSubscribed(true);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications";
      console.error("[usePushNotifications] Subscribe error:", err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, role, customerId, userName]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to disable notifications";
      console.error("[usePushNotifications] Unsubscribe error:", err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const sendTestNotification = useCallback(async () => {
    if (!isSupported || !isSubscribed) {
      setError("Please enable notifications first before testing.");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        throw new Error("No active browser subscription found.");
      }

      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to trigger test notification.");
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test notification failed";
      console.error("[usePushNotifications] Test error:", err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, isSubscribed]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    isIosWithoutPwa,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
