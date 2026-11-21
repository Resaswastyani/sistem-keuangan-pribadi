import { z } from "zod"
import { HttpError, json, readJson, rupiah, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { notifyUser } from "@/lib/notify"

type Ctx = { params: Promise<{ id: string }> }

/** Setor tabungan: saldo berkurang (transaksi kategori Tabungan) dan target bertambah, dalam satu transaksi DB. */
export const POST = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const { amount } = await readJson(req, z.object({ amount: rupiah }))

  const [goal] = await sql`select id, kind, title, target_amount, saved_amount from goals where id = ${id} and user_id = ${user.id}`
  if (!goal) throw new HttpError(404, "Target tidak ditemukan.")
  if (goal.kind !== "money") throw new HttpError(400, "Target pencapaian tidak memakai tabungan.")

  await sql.transaction([
    sql`insert into transactions (user_id, goal_id, name, category, amount) values (${user.id}, ${id}, ${"Tabungan " + goal.title}, 'Tabungan', ${-amount})`,
    sql`update goals set saved_amount = saved_amount + ${amount} where id = ${id} and user_id = ${user.id}`,
  ])

  const before = Number(goal.saved_amount)
  const target = Number(goal.target_amount)
  if (before < target && before + amount >= target) {
    await notifyUser(user.id, { kind: "goal", title: "🎉 Target tercapai!", body: `${goal.title} sudah terkumpul 100%. Kamu hebat!`, url: "/?tab=Target" })
  }
  return json({ ok: true }, { status: 201 })
})
