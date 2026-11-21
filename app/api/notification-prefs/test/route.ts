import { z } from "zod"
import { HttpError, json, readJson, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { addDays, sunnahFasts, toHijri } from "@/lib/hijri"
import { notifyUser } from "@/lib/notify"
import { PREF_KEYS, renderPref, sisaLabel } from "@/lib/notification-prefs"
import { getPrayerTimes } from "@/lib/prayer"
import { getPrefs, localNow } from "@/lib/prefs-server"
import { money, prayerVars } from "@/lib/scheduled"

/** Kirim contoh notifikasi dengan pesan (draft) yang sedang diedit, memakai data hari ini. */
export const POST = withUser(async (req, { user }) => {
  const b = await readJson(req, z.object({
    key: z.enum(PREF_KEYS as [string, ...string[]]),
    title: z.string().trim().max(120).nullable().optional(),
    body: z.string().trim().max(300).nullable().optional(),
    beforeMin: z.number().int().min(0).max(180).optional(),
  }))
  const prefs = await getPrefs(user.id)
  const base = prefs.find((p) => p.key === b.key)
  if (!base) throw new HttpError(400, "Jenis notifikasi tidak dikenal.")
  const p = { ...base, customTitle: b.title === undefined ? base.customTitle : b.title || null, customBody: b.body === undefined ? base.customBody : b.body || null }

  const [u] = await sql`select display_name, city_id, city_name, hijri_offset from users where id = ${user.id}`
  const { day } = localNow(APP_TZ)
  const hijri = toHijri(day, u.hijri_offset).label
  let vars: Record<string, string | number> = { nama: u.display_name }

  if (["subuh", "dhuha", "dzuhur", "ashar", "maghrib", "isya", "sahur", "imsak", "buka"].includes(b.key)) {
    const t = (await getPrayerTimes(u.city_id, u.city_name, day, day).catch(() => []))[0]
    const field = b.key === "sahur" || b.key === "imsak" ? "imsak" : b.key === "buka" ? "maghrib" : (b.key as "subuh")
    vars = prayerVars(u as { display_name: string; city_name: string }, b.key, t?.[field] ?? "--:--", b.beforeMin ?? base.beforeMin ?? 0, hijri)
  } else if (b.key === "puasa_sunnah") {
    const next = Array.from({ length: 30 }, (_, i) => addDays(day, i + 1)).find((d) => sunnahFasts(d, u.hijri_offset).length)
    vars = { nama: u.display_name, jenis: next ? sunnahFasts(next, u.hijri_offset).join(" & ") : "Senin", tanggal_hijriah: next ? toHijri(next, u.hijri_offset).label : hijri }
  } else if (b.key === "digest") {
    vars = { nama: u.display_name, ringkasan: "Hari ini kamu mencatat 3 transaksi, pengeluaran Rp 75.000. Besok ada 2 agenda.", jumlah_transaksi: 3, pengeluaran: money(75000), agenda_besok: 2 }
  } else if (b.key === "budget") {
    vars = { nama: u.display_name, persen: 80, terpakai: money(960000), anggaran: money(1200000) }
  } else if (b.key === "schedule") {
    vars = { nama: u.display_name, judul: "Belajar matematika", waktu: "19:00", sisa: sisaLabel(10), detail: "Bab 3 · Limit" }
  }

  const msg = renderPref(p, vars)
  const { sent } = await notifyUser(user.id, { kind: "test", ...msg, url: "/?tab=Ibadah", tag: `test-${b.key}` })
  return json({ sent, ...msg })
})
