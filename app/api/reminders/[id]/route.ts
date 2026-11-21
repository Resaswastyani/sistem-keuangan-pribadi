import { z } from "zod"
import { HttpError, json, readJson, uuid, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withUser<Ctx>(async (req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const { done } = await readJson(req, z.object({ done: z.boolean() }))
  const [row] = await sql`update reminders set done = ${done} where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Pengingat tidak ditemukan.")
  return json({ ok: true })
})

export const DELETE = withUser<Ctx>(async (_req, { user, params }) => {
  const id = uuid.parse((await params).id)
  const [row] = await sql`delete from reminders where id = ${id} and user_id = ${user.id} returning id`
  if (!row) throw new HttpError(404, "Pengingat tidak ditemukan.")
  return json({ ok: true })
})
