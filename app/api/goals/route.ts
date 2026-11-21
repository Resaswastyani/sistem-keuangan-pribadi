import { json, readJson, withUser } from "@/lib/api"
import { goalSchema } from "@/lib/schemas"
import { sql } from "@/lib/db"

export const POST = withUser(async (req, { user }) => {
  const g = await readJson(req, goalSchema)
  const [row] = await sql`
    insert into goals (user_id, title, note, target_amount, deadline, color, icon)
    values (${user.id}, ${g.title}, ${g.note}, ${g.targetAmount}, ${g.deadline ?? null}, ${g.color}, ${g.icon})
    returning id`
  return json({ id: row.id }, { status: 201 })
})
