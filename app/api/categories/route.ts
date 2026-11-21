import { z } from "zod"
import { HttpError, json, readJson, withUser } from "@/lib/api"
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categories"
import { sql } from "@/lib/db"

const name = z.string().trim().min(1).max(40).regex(/^[^<>]+$/, "Karakter tidak valid")

export const GET = withUser(async (_req, { user }) => {
  const rows = await sql`select id, kind, name from categories where user_id = ${user.id} order by created_at`
  return json({ categories: rows })
})

/** Tambah kategori sendiri, mis. "Kos", "Skincare", "Freelance". */
export const POST = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({ kind: z.enum(["expense", "income"]), name }))
  const defaults = b.kind === "expense" ? DEFAULT_EXPENSE_CATEGORIES : DEFAULT_INCOME_CATEGORIES
  if (defaults.some((d) => d.toLowerCase() === b.name.toLowerCase())) return json({ ok: true, existing: true })
  const rows = await sql`
    insert into categories (user_id, kind, name) values (${user.id}, ${b.kind}, ${b.name})
    on conflict (user_id, kind, lower(name)) do nothing returning id`
  if (!rows.length) return json({ ok: true, existing: true })
  return json({ ok: true, id: rows[0].id }, { status: 201 })
})

export const PATCH = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({ id: z.string().uuid(), name }))
  const [cur] = await sql`select kind, name from categories where id = ${b.id} and user_id = ${user.id}`
  if (!cur) throw new HttpError(404, "Kategori tidak ditemukan.")
  try {
    await sql.transaction([
      sql`update categories set name = ${b.name} where id = ${b.id} and user_id = ${user.id}`,
      // Transaksi lama ikut memakai nama baru.
      sql`update transactions set category = ${b.name} where user_id = ${user.id} and category = ${cur.name}`,
    ])
  } catch {
    throw new HttpError(409, "Nama kategori sudah dipakai.")
  }
  return json({ ok: true })
})

/** Hapus kategori. Transaksi lama tetap menyimpan nama kategorinya. */
export const DELETE = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({ id: z.string().uuid() }))
  await sql`delete from categories where id = ${b.id} and user_id = ${user.id}`
  return json({ ok: true })
})
