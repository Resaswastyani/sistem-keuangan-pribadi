import { z } from "zod"
import { json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Catat / rencanakan puasa. status "planned" juga mengaktifkan pengingat sahur, imsak & berbuka di hari itu. */
export const PUT = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({
    day,
    kind: z.enum(["ramadan", "sunnah", "qadha", "nazar"]),
    status: z.enum(["planned", "done", "missed"]),
    note: z.string().trim().max(120).optional().default(""),
  }))
  await sql`
    insert into fasting_log (user_id, day, kind, status, note) values (${user.id}, ${b.day}::date, ${b.kind}, ${b.status}, ${b.note})
    on conflict (user_id, day) do update set kind = excluded.kind, status = excluded.status, note = excluded.note, updated_at = now()`
  return json({ ok: true })
})

export const DELETE = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({ day }))
  await sql`delete from fasting_log where user_id = ${user.id} and day = ${b.day}::date`
  return json({ ok: true })
})
