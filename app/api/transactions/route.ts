import { z } from "zod"
import { json, readJson, rupiah, shortText, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

const schema = z.object({
  name: shortText(),
  amount: rupiah,
  kind: z.enum(["expense", "income"]),
  category: z.string().trim().min(1).max(40).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
})

export const POST = withUser(async (req, { user }) => {
  const body = await readJson(req, schema)
  const amount = body.kind === "income" ? body.amount : -body.amount
  const category = body.category ?? (body.kind === "income" ? "Pemasukan" : "Lainnya")
  const [row] = await sql`
    insert into transactions (user_id, name, category, amount, occurred_at)
    values (${user.id}, ${body.name}, ${category}, ${amount}, coalesce(${body.occurredAt ?? null}::timestamptz, now()))
    returning id`
  return json({ id: row.id }, { status: 201 })
})
