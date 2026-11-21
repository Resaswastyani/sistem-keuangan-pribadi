import { z } from "zod"
import { HttpError, json, readJson, withUser } from "@/lib/api"
import { sql } from "@/lib/db"
import { searchCities } from "@/lib/prayer"

const schema = z.object({
  cityId: z.string().regex(/^[0-9a-f]{1,40}$/i).optional(),
  hijriOffset: z.number().int().min(-2).max(2).optional(),
})

export const PATCH = withUser(async (req, { user }) => {
  const body = await readJson(req, z.object({ ...schema.shape, cityName: z.string().trim().min(3).max(80).optional() }))
  let cityName: string | null = null
  if (body.cityId) {
    // Validasi kota ke sumber data supaya ID-nya benar-benar ada.
    if (!body.cityName) throw new HttpError(400, "Nama kota wajib diisi.")
    const found = await searchCities(body.cityName.replace(/^(KAB\.|KOTA)\s*/i, "")).catch(() => [])
    const match = found.find((c) => c.id === body.cityId)
    if (!match) throw new HttpError(400, "Kota tidak ditemukan.")
    cityName = match.name
  }
  await sql`
    update users set
      city_id = coalesce(${body.cityId ?? null}, city_id),
      city_name = coalesce(${cityName}, city_name),
      hijri_offset = coalesce(${body.hijriOffset ?? null}::int, hijri_offset),
      updated_at = now()
    where id = ${user.id}`
  if (body.cityId) await sql`delete from notification_log where user_id = ${user.id} and day = current_date and key in ('subuh','dhuha','dzuhur','ashar','maghrib','isya','sahur','imsak','buka')`
  return json({ ok: true, cityName })
})
