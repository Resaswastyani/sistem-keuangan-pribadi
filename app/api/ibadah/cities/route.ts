import { z } from "zod"
import { HttpError, json, withUser } from "@/lib/api"
import { searchCities } from "@/lib/prayer"

export const GET = withUser(async (req) => {
  const q = z.string().trim().min(3, "Minimal 3 huruf").max(40).regex(/^[\p{L}\s.'-]+$/u).parse(new URL(req.url).searchParams.get("q") ?? "")
  try {
    return json({ cities: await searchCities(q) })
  } catch {
    throw new HttpError(502, "Layanan pencarian kota sedang tidak tersedia.")
  }
})
