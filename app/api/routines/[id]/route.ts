import { HttpError, json, uuid, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

/** Hapus rutinitas: agenda hari ini & ke depan ikut terhapus, riwayat hari lalu tetap ada. */
export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`update routines set active = false where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Rutinitas tidak ditemukan.")
  await sql`delete from schedule_items where routine_id = ${id} and user_id = ${user.id} and day >= (now() at time zone ${APP_TZ})::date and done = false`
  return json({ ok: true })
})
