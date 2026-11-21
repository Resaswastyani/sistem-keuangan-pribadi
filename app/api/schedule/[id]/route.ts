import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { schedulePatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const s = await readJson(req, schedulePatchSchema)

  const [current] = await sql`select to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time from schedule_items where id = ${id} and user_id = ${user.id}`
  if (!current) throw new HttpError(404, "Kegiatan tidak ditemukan.")
  if ((s.endTime ?? current.end_time) <= (s.startTime ?? current.start_time)) throw new HttpError(400, "Jam selesai harus setelah jam mulai.")

  // Jika waktu berubah, pengingat dijadwalkan ulang.
  const timeChanged = s.day !== undefined || s.startTime !== undefined || s.remindBeforeMin !== undefined
  await sql`
    update schedule_items set
      day = coalesce(${s.day ?? null}::date, day),
      start_time = coalesce(${s.startTime ?? null}::time, start_time),
      end_time = coalesce(${s.endTime ?? null}::time, end_time),
      title = coalesce(${s.title ?? null}, title),
      detail = coalesce(${s.detail ?? null}, detail),
      icon = coalesce(${s.icon ?? null}, icon),
      color = coalesce(${s.color ?? null}, color),
      done = coalesce(${s.done ?? null}::boolean, done),
      remind_before_min = case when ${s.remindBeforeMin !== undefined} then ${s.remindBeforeMin ?? null}::int else remind_before_min end,
      reminded_at = case when ${timeChanged} then null else reminded_at end
    where id = ${id} and user_id = ${user.id}`
  return json({ ok: true })
})

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from schedule_items where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Kegiatan tidak ditemukan.")
  return json({ ok: true })
})
