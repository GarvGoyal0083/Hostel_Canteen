"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getToken, onMessage, isSupported } from "firebase/messaging";
import { getFirebaseApp, getFirebaseMessagingInstance, firebaseConfig } from "@/lib/firebase/config";

export interface UseFcmNotificationsOptions {
  customerId?: string | null;
  customerName?: string | null;
}

export interface ForegroundNotification {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  receivedAt: string;
}

export function useFcmNotifications({ customerId, customerName }: UseFcmNotificationsOptions = {}) {
  const [isSupportedBrowser, setIsSupportedBrowser] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [foregroundMessage, setForegroundMessage] = useState<ForegroundNotification | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);
  const [vapidKey, setVapidKey] = useState<string>("");

  const unsubscribeOnMessage = useRef<(() => void) | null>(null);

  // Initial check on mount: check browser support, current permission, and fetch config
  useEffect(() => {
    if (typeof window === "undefined") return;

    let mounted = true;

    async function checkSupport() {
      try {
        const hasSw = "serviceWorker" in navigator;
        const hasNotif = "Notification" in window;
        const fcmSupported = await isSupported();

        if (!hasSw || !hasNotif || !fcmSupported) {
          if (mounted) setIsSupportedBrowser(false);
          return;
        }

        if (mounted) {
          setIsSupportedBrowser(true);
          setPermission(Notification.permission);
        }

        // Fetch runtime config to verify VAPID key and env status
        const res = await fetch("/api/firebase/config");
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setConfigured(Boolean(data.configured));
            setVapidKey(data.vapidKey || "");
          }
        }
      } catch (err) {
        console.warn("[FCM] Support check error:", err);
      }
    }

    checkSupport();

    return () => {
      mounted = false;
      if (unsubscribeOnMessage.current) {
        unsubscribeOnMessage.current();
      }
    };
  }, []);

  // Request Permission & Obtain FCM Token ONLY when explicitly called by user action
  const requestPermissionAndToken = useCallback(async (): Promise<string | null> => {
    if (!isSupportedBrowser) {
      setError("Web push notifications are not supported by this browser.");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request Browser Permission
      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission === "denied") {
        setError(
          "Notifications were blocked. Please enable notification permissions in your browser site settings."
        );
        return null;
      }

      if (requestedPermission !== "granted") {
        setError("Notification permission was dismissed without granting.");
        return null;
      }

      // 2. Register Firebase Messaging Service Worker
      let swRegistration: ServiceWorkerRegistration;
      try {
        swRegistration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        await navigator.serviceWorker.ready;

        // Post config to active SW
        if (swRegistration.active) {
          swRegistration.active.postMessage({
            type: "INIT_FIREBASE_CONFIG",
            config: firebaseConfig,
          });
        }
      } catch (swErr) {
        console.error("[FCM] SW registration failed:", swErr);
        throw new Error(
          "Failed to register background push service worker. Please ensure HTTPS is active."
        );
      }

      // 3. Obtain Firebase Messaging Instance
      const messaging = await getFirebaseMessagingInstance();
      if (!messaging) {
        throw new Error("Firebase Messaging could not be initialized on this device.");
      }

      // 4. Retrieve VAPID Key from API if not already set
      let effectiveVapidKey = vapidKey;
      if (!effectiveVapidKey) {
        try {
          const cfgRes = await fetch("/api/firebase/config");
          if (cfgRes.ok) {
            const cfgData = await cfgRes.json();
            effectiveVapidKey = cfgData.vapidKey || "";
          }
        } catch {
          // ignore
        }
      }

      // 5. Obtain FCM Registration Token
      const token = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
        vapidKey: effectiveVapidKey || undefined,
      });

      if (!token) {
        throw new Error("No FCM registration token received from Firebase.");
      }

      setFcmToken(token);

      // 6. Save token to application backend
      await fetch("/api/firebase/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          customer_id: customerId || null,
          customer_name: customerName || null,
        }),
      }).catch((saveErr) => console.warn("[FCM] Error saving token to backend:", saveErr));

      // 7. Setup Foreground Message Listener (without duplicate system notification)
      if (unsubscribeOnMessage.current) {
        unsubscribeOnMessage.current();
      }

      unsubscribeOnMessage.current = onMessage(messaging, (payload) => {
        const notifTitle =
          payload.notification?.title ||
          payload.data?.title ||
          "Hostel Canteen";
        const notifBody =
          payload.notification?.body ||
          payload.data?.body ||
          "New update received!";
        const notifUrl = payload.data?.url || "/customer";

        // Display in-app banner for foreground message without showing a duplicate OS popup
        setForegroundMessage({
          title: notifTitle,
          body: notifBody,
          icon: payload.notification?.icon || "/logo.svg",
          url: notifUrl,
          receivedAt: new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      });

      return token;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enable notifications";
      console.error("[FCM] requestPermissionAndToken error:", err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isSupportedBrowser, vapidKey, customerId, customerName]);

  // Show a local test notification to verify OS display and click behavior
  const showTestNotification = useCallback(async () => {
    if (Notification.permission !== "granted") {
      setError("Please grant notification permission first.");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 Hostel Canteen Push Test", {
        body: "Firebase Cloud Messaging web push is configured and ready to receive updates!",
        icon: "/logo.svg",
        badge: "/logo.svg",
        data: { url: "/customer" },
        tag: `fcm-test-${Date.now()}`,
      });
    } catch (err) {
      console.error("[FCM] showTestNotification error:", err);
      // Fallback to native window.Notification
      try {
        new Notification("🔔 Hostel Canteen Push Test", {
          body: "Firebase Cloud Messaging web push is working!",
          icon: "/logo.svg",
        });
      } catch (inner) {
        setError("Could not display notification popup in this browser window.");
      }
    }
  }, []);

  return {
    isSupportedBrowser,
    permission,
    fcmToken,
    loading,
    error,
    configured,
    foregroundMessage,
    dismissForegroundMessage: () => setForegroundMessage(null),
    requestPermissionAndToken,
    showTestNotification,
  };
}
