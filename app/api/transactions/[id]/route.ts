import { HttpError, json, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from transactions where id = ${id} and user_id = ${user.id} returning goal_id, amount`
  if (!row) throw new HttpError(404, "Transaksi tidak ditemukan.")
  // Jika transaksi adalah setoran tabungan, kembalikan saldo target.
  if (row.goal_id) {
    await sql`update goals set saved_amount = greatest(0, saved_amount - ${Math.abs(Number(row.amount))}) where id = ${row.goal_id} and user_id = ${user.id}`
  }
  return json({ ok: true })
})
