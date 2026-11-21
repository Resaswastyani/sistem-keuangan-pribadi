import "server-only"
import { NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { getSessionUser, type SessionUser } from "./auth"

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const json = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } })

type Handler<C> = (req: Request, ctx: C & { user: SessionUser }) => Promise<Response>

/** Bungkus route handler: wajib login, tangani error validasi tanpa membocorkan detail internal. */
export function withUser<C = object>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await getSessionUser()
      if (!user) return json({ error: "Sesi berakhir, silakan masuk lagi." }, { status: 401 })
      return await handler(req, { ...ctx, user })
    } catch (error) {
      return handleError(error)
    }
  }
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, { status: error.status })
  if (error instanceof ZodError) return json({ error: "Data tidak valid.", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 })
  console.error(error)
  return json({ error: "Terjadi kesalahan di server." }, { status: 500 })
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const length = Number(req.headers.get("content-length") ?? 0)
  if (length > 16_384) throw new HttpError(413, "Payload terlalu besar.")
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new HttpError(400, "Body harus JSON.")
  }
  return schema.parse(body)
}

export const uuid = z.string().uuid()
export const shortText = (max = 80) => z.string().trim().min(1).max(max)
export const optionalText = (max = 160) => z.string().trim().max(max).optional().default("")
export const rupiah = z.coerce.number().int().positive().max(1_000_000_000_000)
export const iconKey = z.enum(["sparkles", "bell", "book", "music", "coffee", "dumbbell", "headphones", "laptop", "plane", "wallet", "heart", "home", "card"])
export const colorKey = z.enum(["pink", "violet", "mint", "amber"])
