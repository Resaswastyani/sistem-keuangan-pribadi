import "server-only"
import { sql } from "./db"

export const PRAYER_KEYS = ["imsak", "subuh", "terbit", "dhuha", "dzuhur", "ashar", "maghrib", "isya"] as const
export type PrayerKey = (typeof PRAYER_KEYS)[number]
export type PrayerDay = { day: string } & Record<PrayerKey, string>

const MYQURAN = "https://api.myquran.com/v2"
const ALADHAN = "https://api.aladhan.com/v1"
const TIME = /^\d{2}:\d{2}$/

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${new URL(url).host}`)
  return res.json()
}

const addMin = (t: string, m: number) => {
  const total = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + m
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** Sumber utama: MyQuran (data resmi Kemenag RI). */
async function fromMyQuran(cityId: string, year: number, month: number): Promise<PrayerDay[]> {
  const json = await getJson(`${MYQURAN}/sholat/jadwal/${encodeURIComponent(cityId)}/${year}/${String(month).padStart(2, "0")}`)
  const rows = json?.data?.jadwal
  if (!json?.status || !Array.isArray(rows) || rows.length < 28) throw new Error("Data MyQuran tidak lengkap")
  return rows.map((r: Record<string, string>) => ({ day: r.date, imsak: r.imsak, subuh: r.subuh, terbit: r.terbit, dhuha: r.dhuha, dzuhur: r.dzuhur, ashar: r.ashar, maghrib: r.maghrib, isya: r.isya }))
}

/** Cadangan: Aladhan dengan metode perhitungan Kemenag (method=20). */
async function fromAladhan(cityName: string, year: number, month: number): Promise<PrayerDay[]> {
  const city = cityName.replace(/^(KAB\.|KOTA)\s*/i, "").trim()
  const json = await getJson(`${ALADHAN}/calendarByCity/${year}/${month}?city=${encodeURIComponent(city)}&country=Indonesia&method=20`)
  if (json?.code !== 200 || !Array.isArray(json.data)) throw new Error("Data Aladhan tidak tersedia")
  const clean = (v: string) => v.slice(0, 5)
  return json.data.map((d: { timings: Record<string, string>; date: { gregorian: { date: string } } }) => {
    const [dd, mm, yyyy] = d.date.gregorian.date.split("-")
    const t = d.timings
    return { day: `${yyyy}-${mm}-${dd}`, imsak: clean(t.Imsak), subuh: clean(t.Fajr), terbit: clean(t.Sunrise), dhuha: addMin(clean(t.Sunrise), 28), dzuhur: clean(t.Dhuhr), ashar: clean(t.Asr), maghrib: clean(t.Maghrib), isya: clean(t.Isha) }
  })
}

const inflight = new Map<string, Promise<void>>()

/** Pastikan jadwal sebulan untuk kota ini ada di cache DB; ambil dari API bila belum. */
export async function ensureMonth(cityId: string, cityName: string, year: number, month: number) {
  const first = `${year}-${String(month).padStart(2, "0")}-01`
  const [{ count }] = await sql`
    select count(*)::int as count from prayer_times
    where city_id = ${cityId} and day >= ${first}::date and day < (${first}::date + interval '1 month')`
  if (count >= 28) return

  const key = `${cityId}:${first}`
  if (!inflight.has(key)) {
    inflight.set(key, (async () => {
      let rows: PrayerDay[]
      let source = "myquran"
      try {
        rows = await fromMyQuran(cityId, year, month)
      } catch (error) {
        console.warn("MyQuran gagal, pakai Aladhan:", (error as Error).message)
        rows = await fromAladhan(cityName, year, month)
        source = "aladhan"
      }
      rows = rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day) && PRAYER_KEYS.every((k) => TIME.test(r[k])))
      if (!rows.length) throw new Error("Jadwal sholat kosong")
      await sql`
        insert into prayer_times (city_id, day, imsak, subuh, terbit, dhuha, dzuhur, ashar, maghrib, isya, source)
        select ${cityId}, x.day::date, x.imsak::time, x.subuh::time, x.terbit::time, x.dhuha::time, x.dzuhur::time, x.ashar::time, x.maghrib::time, x.isya::time, ${source}
        from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
          as x(day text, imsak text, subuh text, terbit text, dhuha text, dzuhur text, ashar text, maghrib text, isya text)
        on conflict (city_id, day) do update set
          imsak = excluded.imsak, subuh = excluded.subuh, terbit = excluded.terbit, dhuha = excluded.dhuha, dzuhur = excluded.dzuhur,
          ashar = excluded.ashar, maghrib = excluded.maghrib, isya = excluded.isya, source = excluded.source, fetched_at = now()`
    })().finally(() => inflight.delete(key)))
  }
  await inflight.get(key)
}

/** Ambil jadwal untuk rentang tanggal (otomatis mengisi cache bulan yang dibutuhkan). */
export async function getPrayerTimes(cityId: string, cityName: string, from: string, to: string): Promise<PrayerDay[]> {
  const months = new Set<string>()
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) months.add(d.toISOString().slice(0, 7))
  for (const m of months) await ensureMonth(cityId, cityName, Number(m.slice(0, 4)), Number(m.slice(5, 7)))
  const rows = await sql`
    select to_char(day, 'YYYY-MM-DD') as day,
      to_char(imsak, 'HH24:MI') as imsak, to_char(subuh, 'HH24:MI') as subuh, to_char(terbit, 'HH24:MI') as terbit, to_char(dhuha, 'HH24:MI') as dhuha,
      to_char(dzuhur, 'HH24:MI') as dzuhur, to_char(ashar, 'HH24:MI') as ashar, to_char(maghrib, 'HH24:MI') as maghrib, to_char(isya, 'HH24:MI') as isya
    from prayer_times where city_id = ${cityId} and day between ${from}::date and ${to}::date order by day`
  return rows as PrayerDay[]
}

export async function searchCities(q: string): Promise<{ id: string; name: string }[]> {
  const json = await getJson(`${MYQURAN}/sholat/kota/cari/${encodeURIComponent(q)}`)
  if (!json?.status || !Array.isArray(json.data)) return []
  return json.data.slice(0, 20).map((c: { id: string; lokasi: string }) => ({ id: String(c.id), name: c.lokasi }))
}
