import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { transactionPatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

/** Edit transaksi. Untuk setoran tabungan, perubahan jumlah ikut menyesuaikan saldo target. */
export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const t = await readJson(req, transactionPatchSchema)
  const [cur] = await sql`
    select amount, goal_id, to_char(occurred_at at time zone ${APP_TZ}, 'YYYY-MM-DD') as day, to_char(occurred_at at time zone ${APP_TZ}, 'HH24:MI') as time
    from transactions where id = ${id} and user_id = ${user.id}`
  if (!cur) throw new HttpError(404, "Transaksi tidak ditemukan.")
  const oldAmount = Number(cur.amount)
  const isSaving = Boolean(cur.goal_id)
  const kind = isSaving ? "expense" : t.kind ?? (oldAmount > 0 ? "income" : "expense")
  const abs = t.amount ?? Math.abs(oldAmount)
  const amount = kind === "income" ? abs : -abs
  const day = t.date ?? cur.day
  const time = t.time ?? cur.time

  await sql`
    update transactions set
      name = coalesce(${t.name ?? null}, name),
      category = case when ${isSaving} then category else coalesce(${t.category ?? null}, category) end,
      amount = ${amount},
      occurred_at = (${day}::date + ${time}::time) at time zone ${APP_TZ}
    where id = ${id} and user_id = ${user.id}`
  if (isSaving && amount !== oldAmount) {
    await sql`update goals set saved_amount = greatest(0, saved_amount + ${Math.abs(amount) - Math.abs(oldAmount)}) where id = ${cur.goal_id} and user_id = ${user.id}`
  }
  return json({ ok: true })
})

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
