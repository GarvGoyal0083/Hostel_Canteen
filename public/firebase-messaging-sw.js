// ==============================================================================
// FIREBASE CLOUD MESSAGING (FCM) SERVICE WORKER
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

// Initialize Firebase compat inside the service worker
function initFirebaseInSW(config) {
  if (isFirebaseInitialized || !config || !config.apiKey || !config.projectId) {
    return;
  }
  try {
    firebase.initializeApp(config);
    isFirebaseInitialized = true;
    const messaging = firebase.messaging();

    // Background push message handler
    messaging.onBackgroundMessage((payload) => {
      // Avoid duplicate notifications: if notification object exists, the browser handles it automatically
      // We only manually showNotification if payload has custom data without an explicit notification object
      if (payload.notification) {
        return;
      }

      const title = (payload.data && payload.data.title) || "Hostel Canteen";
      const options = {
        body: (payload.data && payload.data.body) || "New notification from Hostel Canteen",
        icon: (payload.data && payload.data.icon) || "/logo.svg",
        badge: (payload.data && payload.data.badge) || "/logo.svg",
        data: {
          url: (payload.data && payload.data.url) || "/customer",
        },
        tag: (payload.data && payload.data.tag) || "fcm-canteen-alert",
      };

      self.registration.showNotification(title, options);
    });
  } catch (err) {
    console.warn("[firebase-messaging-sw] Init error:", err);
  }
}

// Fetch Firebase config dynamically on SW activation or push
fetch("/api/firebase/config")
  .then((res) => res.json())
  .then((data) => {
    if (data && data.configured && data.config) {
      initFirebaseInSW(data.config);
    }
  })
  .catch(() => undefined);

// Listen for messages from client windows to initialize config
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "INIT_FIREBASE_CONFIG") {
    initFirebaseInSW(event.data.config);
  }
});

// Handle notification click: Focus active tab or open URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickUrl =
    (event.notification.data && event.notification.data.url) ||
    (event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.data && event.notification.data.FCM_MSG.data.url) ||
    "/customer";

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
