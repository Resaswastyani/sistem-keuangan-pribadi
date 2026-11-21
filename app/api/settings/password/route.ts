import bcrypt from "bcryptjs"
import { z } from "zod"
import { HttpError, json, readJson, withUser } from "@/lib/api"
import { createSessionCookie } from "@/lib/auth"
import { sql } from "@/lib/db"

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z
    .string()
    .min(10, "Minimal 10 karakter")
    .max(200)
    .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Harus mengandung huruf dan angka"),
})

/** Ganti password: semua sesi lain otomatis keluar (token_version naik), sesi ini diperbarui. */
export const POST = withUser(async (req, { user }) => {
  const { currentPassword, newPassword } = await readJson(req, schema)
  const [row] = await sql`select password_hash from users where id = ${user.id}`
  if (!(await bcrypt.compare(currentPassword, row.password_hash))) throw new HttpError(400, "Kata sandi saat ini salah.")
  const hash = await bcrypt.hash(newPassword, 12)
  const [updated] = await sql`
    update users set password_hash = ${hash}, token_version = token_version + 1, updated_at = now()
    where id = ${user.id} returning token_version`
  await createSessionCookie(user.id, updated.token_version)
  return json({ ok: true })
})
