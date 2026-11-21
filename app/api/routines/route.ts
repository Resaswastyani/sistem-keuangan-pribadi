import { z } from "zod"
import { HttpError, colorKey, iconKey, json, optionalText, readJson, shortText, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { materializeRoutines } from "@/lib/routines"

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

const schema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startTime: time,
  endTime: time,
  title: shortText(),
  detail: optionalText(),
  icon: iconKey.default("sparkles"),
  color: colorKey.default("pink"),
  remindBeforeMin: z.number().int().min(0).max(1440).nullable().optional(),
})

export const GET = withUser(async (_req, { user }) => {
  const rows = await sql`
    select id, weekday, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time, title, detail, icon, color, remind_before_min
    from routines where user_id = ${user.id} and active order by weekday, start_time`
  return json({ routines: rows.map((r) => ({ id: r.id, weekday: r.weekday, startTime: r.start_time, endTime: r.end_time, title: r.title, detail: r.detail, icon: r.icon, color: r.color, remindBeforeMin: r.remind_before_min })) })
})

/** Buat rutinitas untuk satu atau beberapa hari dalam seminggu. */
export const POST = withUser(async (req, { user }) => {
  const r = await readJson(req, schema)
  if (r.endTime <= r.startTime) throw new HttpError(400, "Jam selesai harus setelah jam mulai.")
  const days = [...new Set(r.weekdays)]
  await sql`
    insert into routines (user_id, weekday, start_time, end_time, title, detail, icon, color, remind_before_min)
    select ${user.id}, d, ${r.startTime}::time, ${r.endTime}::time, ${r.title}, ${r.detail}, ${r.icon}, ${r.color}, ${r.remindBeforeMin ?? null}::int
    from unnest(${days}::int[]) as d`
  const [{ today }] = await sql`select to_char(now() at time zone ${APP_TZ}, 'YYYY-MM-DD') as today`
  await materializeRoutines(today, user.id)
  return json({ ok: true, created: days.length }, { status: 201 })
})
