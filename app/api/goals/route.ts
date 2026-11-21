import { json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { goalSchema } from "@/lib/schemas"

export const POST = withUser(async (req, { user }) => {
  const g = await readJson(req, goalSchema)
  const money = g.kind === "money"
  // Mode checklist: persen dihitung dari langkah yang sudah dicentang.
  if (!money && g.progressMode === "checklist") {
    g.progress = g.milestones.length ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100) : 0
  }
  const [row] = await sql`
    insert into goals (user_id, kind, title, note, target_amount, progress_mode, progress, milestones, deadline, color, icon, theme)
    values (${user.id}, ${g.kind}, ${g.title}, ${g.note}, ${money ? g.targetAmount ?? null : null},
      ${g.progressMode}, ${money ? 0 : g.progress}, ${JSON.stringify(money ? [] : g.milestones)}::jsonb,
      ${g.deadline ?? null}, ${g.color}, ${g.icon}, ${g.theme ?? null})
    returning id`
  return json({ id: row.id }, { status: 201 })
})
