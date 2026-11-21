import { z } from "zod"
import { HttpError, json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { PREF_KEYS, prefDef } from "@/lib/notification-prefs"
import { getPrefs } from "@/lib/prefs-server"

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const template = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null))

export const GET = withUser(async (_req, { user }) => json({ prefs: await getPrefs(user.id) }))

/** Simpan setelan satu jenis notifikasi. title/body kosong = kembali ke pesan bawaan. */
export const PUT = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({
    key: z.enum(PREF_KEYS as [string, ...string[]]),
    enabled: z.boolean(),
    beforeMin: z.number().int().min(0).max(180).optional(),
    atTime: time.optional(),
    title: template(120),
    body: template(300),
  }))
  const def = prefDef(b.key)
  if (!def) throw new HttpError(400, "Jenis notifikasi tidak dikenal.")
  await sql`
    insert into notification_prefs (user_id, key, enabled, before_min, at_time, title, body)
    values (${user.id}, ${b.key}, ${b.enabled}, ${def.beforeMin === null ? 0 : b.beforeMin ?? def.beforeMin},
      ${def.atTime === null ? null : b.atTime ?? def.atTime}::time, ${b.title ?? null}, ${b.body ?? null})
    on conflict (user_id, key) do update set
      enabled = excluded.enabled, before_min = excluded.before_min, at_time = excluded.at_time,
      title = excluded.title, body = excluded.body, updated_at = now()`
  return json({ ok: true })
})
