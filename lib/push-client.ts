"use client"

import { api } from "./client-api"

export type PushEnv = {
  supported: boolean
  ios: boolean
  standalone: boolean
  permission: NotificationPermission | "unsupported"
  /** iOS hanya mengizinkan push setelah app ditambahkan ke Layar Utama. */
  needsInstall: boolean
}

export function pushEnv(): PushEnv {
  if (typeof window === "undefined") return { supported: false, ios: false, standalone: false, permission: "unsupported", needsInstall: false }
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  return {
    supported,
    ios,
    standalone,
    permission: "Notification" in window ? Notification.permission : "unsupported",
    needsInstall: ios && !standalone,
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
  } catch (error) {
    console.warn("SW gagal didaftarkan", error)
    return null
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration("/")
  return reg ? reg.pushManager.getSubscription() : null
}

/** Minta izin + daftarkan perangkat ini untuk menerima notifikasi push. Harus dipanggil dari klik user. */
export async function enablePush() {
  const env = pushEnv()
  if (env.needsInstall) throw new Error("Di iPhone/iPad, tambahkan mellow ke Layar Utama dulu (Bagikan → Tambah ke Layar Utama), lalu buka dari ikon tersebut.")
  if (!env.supported) throw new Error("Browser ini belum mendukung notifikasi push.")
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) throw new Error("Kunci VAPID belum dikonfigurasi di server.")

  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak. Aktifkan lewat pengaturan browser/HP.")

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
  await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() })
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}
