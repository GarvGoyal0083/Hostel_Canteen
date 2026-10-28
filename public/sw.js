// =============================================================================
// HOSTEL CANTEEN POS & STUDENT PORTAL — SERVICE WORKER FOR WEB PUSH NOTIFICATIONS
// =============================================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let title = "Hostel Canteen";
  let options = {
    body: "You have a new update from Hostel Canteen.",
    icon: "/logo.svg",
    badge: "/logo.svg",
    vibrate: [200, 100, 200, 100, 200],
    data: { url: "/" },
    tag: "hostel-canteen-" + Date.now(),
    renotify: true,
    requireInteraction: true,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      options.body = payload.body || options.body;
      if (payload.icon) options.icon = payload.icon;
      if (payload.badge) options.badge = payload.badge;
      if (payload.tag) options.tag = payload.tag;
      if (payload.data && typeof payload.data === "object") {
        options.data = payload.data;
      } else if (payload.url) {
        options.data = { url: payload.url };
      }
      if (payload.actions && Array.isArray(payload.actions)) {
        options.actions = payload.actions;
      }
    } catch (err) {
      try {
        const text = event.data.text();
        if (text) options.body = text;
      } catch {
        // fallback to default options
      }
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if (client.url && "navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
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
