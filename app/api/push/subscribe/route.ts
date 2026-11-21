import { z } from "zod"
import { json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

const subscription = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Endpoint harus https"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
})

export const POST = withUser(async (req, { user }) => {
  const sub = await readJson(req, subscription)
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300)
  await sql`
    insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    values (${user.id}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${ua})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`
  return json({ ok: true }, { status: 201 })
})

export const DELETE = withUser(async (req, { user }) => {
  const { endpoint } = await readJson(req, z.object({ endpoint: z.string().url().max(1000) }))
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${user.id}`
  return json({ ok: true })
})

export const GET = withUser(async (_req, { user }) => {
  const [{ count }] = await sql`select count(*)::int as count from push_subscriptions where user_id = ${user.id}`
  return json({ devices: count })
})
