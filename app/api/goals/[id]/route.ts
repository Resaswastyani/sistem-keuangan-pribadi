import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { goalPatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const g = await readJson(req, goalPatchSchema)
  const [row] = await sql`
    update goals set
      title = coalesce(${g.title ?? null}, title),
      note = coalesce(${g.note ?? null}, note),
      target_amount = coalesce(${g.targetAmount ?? null}::bigint, target_amount),
      deadline = case when ${g.deadline !== undefined} then ${g.deadline ?? null}::date else deadline end,
      color = coalesce(${g.color ?? null}, color),
      icon = coalesce(${g.icon ?? null}, icon)
    where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Target tidak ditemukan.")
  return json({ ok: true })
})

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from goals where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Target tidak ditemukan.")
  return json({ ok: true })
})
