import { json, readJson, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { reminderSchema } from "@/lib/schemas"

export const POST = withUser(async (req, { user }) => {
  const r = await readJson(req, reminderSchema)
  // Tanggal + jam diinterpretasikan dalam zona waktu aplikasi (default Asia/Jakarta).
  const [row] = await sql`
    insert into reminders (user_id, title, detail, icon, color, remind_at, repeat)
    values (${user.id}, ${r.title}, ${r.detail}, ${r.icon}, ${r.color},
      (${r.date}::date + ${r.time}::time) at time zone ${APP_TZ}, ${r.repeat})
    returning id, remind_at`
  return json({ id: row.id, remindAt: row.remind_at }, { status: 201 })
})
