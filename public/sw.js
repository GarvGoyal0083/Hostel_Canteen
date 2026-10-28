// ==============================================================================
// HOSTEL CANTEEN — UNIFIED WEB PUSH & FIREBASE CLOUD MESSAGING (FCM) SERVICE WORKER
// ==============================================================================

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

let isFirebaseInitialized = false;

function initFirebaseInSW(config) {
  if (isFirebaseInitialized || !config || !config.apiKey || !config.projectId) {
    return;
  }
  try {
    firebase.initializeApp(config);
    isFirebaseInitialized = true;
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      if (payload.notification) {
        return;
      }

      const title = (payload.data && payload.data.title) || "Hostel Canteen";
      const options = {
        body: (payload.data && payload.data.body) || "New notification from Hostel Canteen",
        icon: (payload.data && payload.data.icon) || "/logo.svg",
        badge: (payload.data && payload.data.badge) || "/logo.svg",
        vibrate: [200, 100, 200, 100, 200],
        data: {
          url: (payload.data && payload.data.url) || "/customer",
        },
        tag: (payload.data && payload.data.tag) || `fcm-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
      };

      self.registration.showNotification(title, options);
    });
  } catch (err) {
    console.warn("[sw] Firebase init error:", err);
  }
}

fetch("/api/firebase/config")
  .then((res) => res.json())
  .then((data) => {
    if (data && data.configured && data.config) {
      initFirebaseInSW(data.config);
    }
  })
  .catch(() => undefined);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "INIT_FIREBASE_CONFIG") {
    initFirebaseInSW(event.data.config);
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const rawText = event.data.text();
    let payload = null;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { body: rawText };
    }

    if (payload.from && payload.fcmMessageId && payload.notification) {
      return;
    }

    const title = payload.title || "Hostel Canteen";
    const options = {
      body: payload.body || "You have a new update from Hostel Canteen.",
      icon: payload.icon || "/logo.svg",
      badge: payload.badge || "/logo.svg",
      vibrate: [200, 100, 200, 100, 200],
      data: payload.data || { url: payload.url || "/" },
      tag: payload.tag || `hc-push-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn("[sw] Push display error:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickUrl =
    (event.notification.data && event.notification.data.url) ||
    (event.notification.data &&
      event.notification.data.FCM_MSG &&
      event.notification.data.FCM_MSG.data &&
      event.notification.data.FCM_MSG.data.url) ||
    "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if (client.url && "navigate" in client) {
            return client.navigate(clickUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickUrl);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription }),
        });
      })
      .catch((err) => {
        console.warn("[sw] Push subscription refresh error:", err);
      })
  );
});
