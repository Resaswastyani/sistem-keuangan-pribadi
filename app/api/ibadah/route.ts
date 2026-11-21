import { z } from "zod"
import { json, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { addDays, isRamadan, sunnahFasts, toHijri } from "@/lib/hijri"
import { getPrayerTimes } from "@/lib/prayer"
import { getPrefs, localNow } from "@/lib/prefs-server"

const monthParam = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()

export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url)
  const now = localNow(APP_TZ)
  const month = monthParam.parse(url.searchParams.get("month") ?? undefined) ?? now.day.slice(0, 7)

  const [u] = await sql`select city_id, city_name, hijri_offset from users where id = ${user.id}`
  const offset: number = u.hijri_offset
  const monthStart = `${month}-01`
  const monthEnd = addDays(addDays(monthStart, 32).slice(0, 7) + "-01", -1)
  const tomorrow = addDays(now.day, 1)

  let prayerError: string | null = null
  let monthTimes: Awaited<ReturnType<typeof getPrayerTimes>> = []
  let nearTimes: typeof monthTimes = []
  try {
    ;[monthTimes, nearTimes] = await Promise.all([
      getPrayerTimes(u.city_id, u.city_name, monthStart, monthEnd),
      getPrayerTimes(u.city_id, u.city_name, now.day, tomorrow),
    ])
  } catch (error) {
    prayerError = `Jadwal sholat belum bisa diambil: ${(error as Error).message}`
  }

  const [prefs, fasting, recap] = await Promise.all([
    getPrefs(user.id),
    sql`select to_char(day, 'YYYY-MM-DD') as day, kind, status from fasting_log
        where user_id = ${user.id} and day between ${addDays(monthStart, -7)}::date and ${addDays(monthEnd, 45)}::date order by day`,
    sql`select kind, status, count(*)::int as count from fasting_log
        where user_id = ${user.id} and day > (now() at time zone ${APP_TZ})::date - interval '400 days' group by kind, status`,
  ])

  // Ramadan tahun Hijriah berjalan: hitung hari yang terlewat (utang) vs qadha yang sudah dibayar.
  const upcoming = Array.from({ length: 45 }, (_, i) => addDays(now.day, i))
    .map((day) => ({ day, hijri: toHijri(day, offset).label, types: sunnahFasts(day, offset), ramadan: isRamadan(day, offset) }))
    .filter((d) => d.types.length > 0 || d.ramadan)
    .slice(0, 20)

  const count = (kind: string, status: string) => recap.find((r) => r.kind === kind && r.status === status)?.count ?? 0

  return json({
    city: { id: u.city_id, name: u.city_name },
    hijriOffset: offset,
    today: now.day,
    nowMinutes: now.minutes,
    hijriToday: toHijri(now.day, offset),
    ramadanToday: isRamadan(now.day, offset),
    sunnahToday: sunnahFasts(now.day, offset),
    sunnahTomorrow: sunnahFasts(tomorrow, offset),
    times: { today: nearTimes.find((t) => t.day === now.day) ?? null, tomorrow: nearTimes.find((t) => t.day === tomorrow) ?? null },
    month,
    monthTimes: monthTimes.map((t) => ({ ...t, hijri: toHijri(t.day, offset).label, sunnah: sunnahFasts(t.day, offset) })),
    prayerError,
    fasting,
    recap: {
      ramadanDone: count("ramadan", "done"),
      ramadanMissed: count("ramadan", "missed"),
      qadhaDone: count("qadha", "done"),
      sunnahDone: count("sunnah", "done"),
      qadhaOwed: Math.max(0, count("ramadan", "missed") - count("qadha", "done")),
    },
    upcoming,
    prefs,
  })
})
