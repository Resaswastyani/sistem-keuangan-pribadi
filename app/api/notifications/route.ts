import { z } from "zod"
import { json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

export const GET = withUser(async (_req, { user }) => {
  const [items, unread] = await Promise.all([
    sql`select id, kind, title, body, url, read_at, created_at from notifications where user_id = ${user.id} order by created_at desc limit 30`,
    sql`select count(*)::int as count from notifications where user_id = ${user.id} and read_at is null`,
  ])
  return json({
    items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url, readAt: n.read_at, createdAt: n.created_at })),
    unreadCount: unread[0].count,
  })
})

/** Tandai sudah dibaca: { ids: [...] } atau { all: true } */
export const PATCH = withUser(async (req, { user }) => {
  const body = await readJson(req, z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })]))
  if ("all" in body) await sql`update notifications set read_at = now() where user_id = ${user.id} and read_at is null`
  else await sql`update notifications set read_at = now() where user_id = ${user.id} and id = any(${body.ids}::uuid[]) and read_at is null`
  return json({ ok: true })
})
