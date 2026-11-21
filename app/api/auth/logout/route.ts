import { clearSessionCookie, getSessionUser } from "@/lib/auth"
import { handleError, json } from "@/lib/api"
import { sql } from "@/lib/db"

/** Logout mencabut SEMUA sesi user (token_version dinaikkan). */
export async function POST() {
  try {
    const user = await getSessionUser()
    if (user) await sql`update users set token_version = token_version + 1 where id = ${user.id}`
    await clearSessionCookie()
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
