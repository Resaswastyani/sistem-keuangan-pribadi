import "server-only"
import { cookies } from "next/headers"
import { sql } from "./db"
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session-token"

export type SessionUser = { id: string; username: string; displayName: string; monthlyBudget: number }

export async function createSessionCookie(userId: string, tokenVersion: number) {
  const token = await signSession({ sub: userId, ver: tokenVersion })
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    priority: "high",
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** Verifikasi token + cek token_version di DB, sehingga logout / ganti password langsung mencabut sesi lama. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value)
  if (!payload) return null
  const rows = await sql`
    select id, username, display_name, monthly_budget, token_version
    from users where id = ${payload.sub} limit 1`
  const row = rows[0]
  if (!row || row.token_version !== payload.ver) return null
  return { id: row.id, username: row.username, displayName: row.display_name, monthlyBudget: Number(row.monthly_budget) }
}
