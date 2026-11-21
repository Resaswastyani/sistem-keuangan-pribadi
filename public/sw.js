/* mellow service worker — menerima push & menampilkan notifikasi sistem (Android, iOS 16.4+, desktop). */
const VERSION = "mellow-v1"

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "mellow", body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "mellow"
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag || VERSION,
    renotify: true,
    timestamp: Date.now(),
    vibrate: [80, 40, 80],
    data: { url: data.url || "/", id: data.id || null },
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // Badge angka di ikon aplikasi (didukung iOS 16.4+ & beberapa Android).
      if (self.navigator && "setAppBadge" in self.navigator) {
        try {
          const shown = await self.registration.getNotifications()
          await self.navigator.setAppBadge(shown.length || 1)
        } catch {}
      }
      // Beri tahu tab yang sedang terbuka agar memuat ulang data.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      clients.forEach((c) => c.postMessage({ type: "mellow:push", payload: data }))
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || "/", self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      if (self.navigator && "clearAppBadge" in self.navigator) {
        try { await self.navigator.clearAppBadge() } catch {}
      }
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus()
          if ("navigate" in client) return client.navigate(target.href)
          return
        }
      }
      return self.clients.openWindow(target.href)
    })(),
  )
})

// iOS/Chrome kadang memperbarui langganan; daftarkan ulang ke server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription
      const appServerKey = old && old.options ? old.options.applicationServerKey : undefined
      if (!appServerKey) return
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey })
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
    })(),
  )
})
