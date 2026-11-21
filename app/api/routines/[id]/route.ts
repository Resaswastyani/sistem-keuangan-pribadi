import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { materializeRoutines } from "@/lib/routines"
import { routinePatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

/** Edit satu rutinitas. Agenda mendatang yang belum selesai dibuat ulang dengan data baru. */
export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const r = await readJson(req, routinePatchSchema)
  const [cur] = await sql`select to_char(start_time, 'HH24:MI') as s, to_char(end_time, 'HH24:MI') as e from routines where id = ${id} and user_id = ${user.id} and active`
  if (!cur) throw new HttpError(404, "Rutinitas tidak ditemukan.")
  if ((r.endTime ?? cur.e) <= (r.startTime ?? cur.s)) throw new HttpError(400, "Jam selesai harus setelah jam mulai.")
  await sql`
    update routines set
      start_time = coalesce(${r.startTime ?? null}::time, start_time),
      end_time = coalesce(${r.endTime ?? null}::time, end_time),
      title = coalesce(${r.title ?? null}, title),
      detail = coalesce(${r.detail ?? null}, detail),
      icon = coalesce(${r.icon ?? null}, icon),
      color = coalesce(${r.color ?? null}, color),
      weekday = coalesce(${r.weekday ?? null}::smallint, weekday),
      remind_before_min = case when ${r.remindBeforeMin !== undefined} then ${r.remindBeforeMin ?? null}::int else remind_before_min end,
      remind_enabled = case when ${r.remindBeforeMin !== undefined} then ${r.remindBeforeMin !== null} else remind_enabled end
    where id = ${id} and user_id = ${user.id}`
  // Buat ulang agenda mendatang (yang dilewati / sudah selesai tetap dipertahankan).
  await sql`delete from schedule_items where routine_id = ${id} and user_id = ${user.id} and day >= (now() at time zone ${APP_TZ})::date and done = false and hidden = false and reminded_at is null`
  const [{ today }] = await sql`select to_char(now() at time zone ${APP_TZ}, 'YYYY-MM-DD') as today`
  await materializeRoutines(today, user.id)
  return json({ ok: true })
})

/** Hapus rutinitas: agenda hari ini & ke depan ikut terhapus, riwayat hari lalu tetap ada. */
export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`update routines set active = false where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Rutinitas tidak ditemukan.")
  await sql`delete from schedule_items where routine_id = ${id} and user_id = ${user.id} and day >= (now() at time zone ${APP_TZ})::date and done = false`
  return json({ ok: true })
})
