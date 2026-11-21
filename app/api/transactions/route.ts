import { z } from "zod"
import { json, readJson, rupiah, shortText, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"

const schema = z.object({
  name: shortText(),
  amount: rupiah,
  kind: z.enum(["expense", "income"]),
  category: z.string().trim().min(1).max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
})

export const POST = withUser(async (req, { user }) => {
  const body = await readJson(req, schema)
  const amount = body.kind === "income" ? body.amount : -body.amount
  const category = body.category ?? (body.kind === "income" ? "Pemasukan" : "Lainnya")
  const [row] = await sql`
    insert into transactions (user_id, name, category, amount, occurred_at)
    values (${user.id}, ${body.name}, ${category}, ${amount},
      case when ${Boolean(body.date)} then (${body.date ?? "2000-01-01"}::date + ${body.time ?? "12:00"}::time) at time zone ${APP_TZ} else now() end)
    returning id`
  return json({ id: row.id }, { status: 201 })
})
