// Dhaaga service worker — handles the buzz push notification + offline shell.
const CACHE = "dhaaga-v5";
const SHELL = ["./", "./index.html", "./app.js", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // network-first for API, cache-first for the app shell
  if (e.request.url.includes("/api/")) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// THE BUZZ: a push from the server arrives even when the app is closed.
self.addEventListener("push", (e) => {
  let data = { title: "Dhaaga", body: "Someone is thinking of you \uD83D\uDC9B", kind: "msg" };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  const isBuzz = data.kind === "buzz";
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: isBuzz ? [120, 60, 120, 60, 200] : [80],
      tag: "dhaaga-" + data.kind,
      renotify: true,
      data: { url: "./index.html" }
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow("./index.html");
    })
  );
});
