import { HttpError, json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { scheduleSchema } from "@/lib/schemas"

export const POST = withUser(async (req, { user }) => {
  const s = await readJson(req, scheduleSchema)
  if (s.endTime <= s.startTime) throw new HttpError(400, "Jam selesai harus setelah jam mulai.")
  const [row] = await sql`
    insert into schedule_items (user_id, day, start_time, end_time, title, detail, icon, color, remind_before_min)
    values (${user.id}, ${s.day}, ${s.startTime}, ${s.endTime}, ${s.title}, ${s.detail}, ${s.icon}, ${s.color}, ${s.remindBeforeMin ?? null})
    returning id`
  return json({ id: row.id }, { status: 201 })
})
