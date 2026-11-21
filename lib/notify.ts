import "server-only"
import { sendNotification, setVapidDetails } from "web-push"
import { sql } from "./db"

let configured = false
function ensureVapid() {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv)
  configured = true
  return true
}

export type NotifyInput = { kind?: string; title: string; body?: string; url?: string; tag?: string }

/** Simpan notifikasi in-app + kirim push ke semua perangkat user. Mengembalikan jumlah push terkirim. */
export async function notifyUser(userId: string, n: NotifyInput) {
  const [row] = await sql`
    insert into notifications (user_id, kind, title, body, url)
    values (${userId}, ${n.kind ?? "info"}, ${n.title}, ${n.body ?? ""}, ${n.url ?? "/"})
    returning id`
  const sent = await pushToUser(userId, { ...n, id: row.id })
  return { id: row.id as string, sent }
}

export async function pushToUser(userId: string, n: NotifyInput & { id?: string }) {
  if (!ensureVapid()) return 0
  const subs = await sql`select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`
  const payload = JSON.stringify({
    title: n.title,
    body: n.body ?? "",
    url: n.url ?? "/",
    tag: n.tag ?? n.id ?? `mellow-${Date.now()}`,
    id: n.id,
  })
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12, urgency: "high" })
        sent++
        await sql`update push_subscriptions set last_used_at = now() where id = ${s.id}`
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        // 404/410 = langganan sudah tidak berlaku (app dihapus / izin dicabut) → hapus.
        if (status === 404 || status === 410) await sql`delete from push_subscriptions where id = ${s.id}`
        else console.error("push gagal", status, (error as Error).message)
      }
    }),
  )
  return sent
}
