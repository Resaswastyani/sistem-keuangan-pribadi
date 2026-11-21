import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { reminderPatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

/** Edit pengingat (judul, detail, waktu, pengulangan, ikon) atau tandai selesai. */
export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const r = await readJson(req, reminderPatchSchema)
  const [cur] = await sql`
    select to_char(remind_at at time zone ${APP_TZ}, 'YYYY-MM-DD') as day, to_char(remind_at at time zone ${APP_TZ}, 'HH24:MI') as time
    from reminders where id = ${id} and user_id = ${user.id}`
  if (!cur) throw new HttpError(404, "Pengingat tidak ditemukan.")
  const timeChanged = r.date !== undefined || r.time !== undefined
  await sql`
    update reminders set
      title = coalesce(${r.title ?? null}, title),
      detail = coalesce(${r.detail ?? null}, detail),
      repeat = coalesce(${r.repeat ?? null}, repeat),
      icon = coalesce(${r.icon ?? null}, icon),
      color = coalesce(${r.color ?? null}, color),
      done = coalesce(${r.done ?? null}::boolean, done),
      remind_at = case when ${timeChanged} then (${r.date ?? cur.day}::date + ${r.time ?? cur.time}::time) at time zone ${APP_TZ} else remind_at end,
      last_sent_at = case when ${timeChanged} then null else last_sent_at end
    where id = ${id} and user_id = ${user.id}`
  return json({ ok: true })
})

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from reminders where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Pengingat tidak ditemukan.")
  return json({ ok: true })
})
