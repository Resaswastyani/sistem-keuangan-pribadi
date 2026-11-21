import bcrypt from "bcryptjs"
import { z } from "zod"
import { createSessionCookie } from "@/lib/auth"
import { handleError, json, readJson } from "@/lib/api"
import { sql } from "@/lib/db"

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
})

const MAX_IP_FAILURES = 10 // per 15 menit per IP
const MAX_ACCOUNT_FAILURES = 5 // lalu akun dikunci 15 menit
const LOCK_MINUTES = 15
// Hash dummy agar waktu respons sama walau username tidak ada (mencegah user enumeration).
const DUMMY_HASH = "$2b$12$koMZU3c6QQzBmneD9SCd/Oznf9yHzgt8AqbEfvnYRRfDhdLp1HUA2"

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim().slice(0, 64)
}

export async function POST(req: Request) {
  try {
    const { username, password } = await readJson(req, schema)
    const ip = clientIp(req)

    const [{ failures }] = await sql`
      select count(*)::int as failures from login_attempts
      where ip = ${ip} and success = false and attempted_at > now() - interval '15 minutes'`
    if (failures >= MAX_IP_FAILURES) {
      return json({ error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, { status: 429, headers: { "Retry-After": "900" } })
    }

    const [user] = await sql`
      select id, password_hash, failed_attempts, locked_until, token_version
      from users where username = ${username} limit 1`

    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      await bcrypt.compare(password, DUMMY_HASH)
      await sql`insert into login_attempts (ip, username, success) values (${ip}, ${username}, false)`
      return json({ error: "Akun dikunci sementara karena banyak percobaan gagal. Coba lagi nanti." }, { status: 423 })
    }

    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH)
    await sql`insert into login_attempts (ip, username, success) values (${ip}, ${username}, ${Boolean(user && valid)})`
    // bersihkan log lama secara oportunistik
    await sql`delete from login_attempts where attempted_at < now() - interval '30 days'`

    if (!user || !valid) {
      if (user) {
        await sql`
          update users set
            failed_attempts = failed_attempts + 1,
            locked_until = case when failed_attempts + 1 >= ${MAX_ACCOUNT_FAILURES}
              then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end
          where id = ${user.id}`
      }
      return json({ error: "Username atau kata sandi salah." }, { status: 401 })
    }

    await sql`update users set failed_attempts = 0, locked_until = null where id = ${user.id}`
    await createSessionCookie(user.id, user.token_version)
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}
