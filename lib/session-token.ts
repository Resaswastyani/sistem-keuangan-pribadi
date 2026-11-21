// Dipakai oleh proxy.ts (tanpa akses DB) dan lib/auth.ts.
import { jwtVerify, SignJWT } from "jose"

export const SESSION_COOKIE = "mellow_session"
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 hari

export type SessionPayload = { sub: string; ver: number }

function secretKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET minimal 32 karakter")
  return new TextEncoder().encode(secret)
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ver: payload.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("mellow")
    .setAudience("mellow-app")
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey())
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: "mellow", audience: "mellow-app" })
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null
    return { sub: payload.sub, ver: payload.ver }
  } catch {
    return null
  }
}
