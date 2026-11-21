import { z } from "zod"
import { json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"

const schema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  monthlyBudget: z.coerce.number().int().min(0).max(1_000_000_000_000).optional(),
})

export const PATCH = withUser(async (req, { user }) => {
  const s = await readJson(req, schema)
  await sql`
    update users set
      display_name = coalesce(${s.displayName ?? null}, display_name),
      monthly_budget = coalesce(${s.monthlyBudget ?? null}::bigint, monthly_budget),
      updated_at = now()
    where id = ${user.id}`
  return json({ ok: true })
})
