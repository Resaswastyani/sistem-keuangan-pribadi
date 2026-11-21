import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { notifyUser } from "@/lib/notify"
import { goalPatchSchema } from "@/lib/schemas"

type Ctx = { params: Promise<{ id: string }> }

/** Edit target, atau perbarui progres pencapaian (persen / checklist / tandai tercapai). */
export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const g = await readJson(req, goalPatchSchema)
  const [before] = await sql`select kind, title, progress_mode, achieved_at from goals where id = ${id} and user_id = ${user.id}`
  if (!before) throw new HttpError(404, "Target tidak ditemukan.")
  const kind = g.kind ?? before.kind
  if (kind === "money" && g.targetAmount === null) throw new HttpError(400, "Jumlah target wajib diisi untuk target uang.")

  // Persen otomatis dari checklist bila mode checklist.
  let progress = g.progress
  const mode = g.progressMode ?? before.progress_mode
  if (g.milestones && mode === "checklist") {
    progress = g.milestones.length ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100) : 0
  }
  if (g.achieved === true) progress = 100
  const achieved = g.achieved ?? (progress === undefined ? undefined : progress >= 100)

  const [row] = await sql`
    update goals set
      kind = ${kind},
      title = coalesce(${g.title ?? null}, title),
      note = coalesce(${g.note ?? null}, note),
      target_amount = case when ${kind} = 'achievement' then null
        when ${g.targetAmount !== undefined} then ${g.targetAmount ?? null}::bigint else target_amount end,
      progress_mode = ${mode},
      progress = coalesce(${progress ?? null}::int, progress),
      milestones = coalesce(${g.milestones ? JSON.stringify(g.milestones) : null}::jsonb, milestones),
      achieved_at = case when ${achieved === undefined} then achieved_at when ${achieved === true} then coalesce(achieved_at, now()) else null end,
      deadline = case when ${g.deadline !== undefined} then ${g.deadline ?? null}::date else deadline end,
      color = coalesce(${g.color ?? null}, color),
      icon = coalesce(${g.icon ?? null}, icon),
      theme = case when ${g.theme !== undefined} then ${g.theme ?? null} else theme end
    where id = ${id} and user_id = ${user.id}
    returning achieved_at`

  if (kind === "achievement" && !before.achieved_at && row.achieved_at) {
    await notifyUser(user.id, { kind: "goal", title: "🏆 Pencapaian tercapai!", body: `${g.title ?? before.title}. Selamat, kamu berhasil!`, url: "/?tab=Target" })
  }
  return json({ ok: true })
})

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from goals where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Target tidak ditemukan.")
  return json({ ok: true })
})
