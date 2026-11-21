// Kalender Hijriah (Umm al-Qura via Intl) + koreksi ±hari agar bisa disamakan dengan keputusan sidang isbat.
// Dipakai di server dan client.

export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", "Jumadil Awal", "Jumadil Akhir", "Rajab", "Syakban", "Ramadan", "Syawal", "Zulkaidah", "Zulhijah"]

const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" })

export type Hijri = { day: number; month: number; year: number; monthName: string; label: string }

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** day = "YYYY-MM-DD" (tanggal Masehi lokal). offset = koreksi hari (−2..+2). */
export function toHijri(day: string, offset = 0): Hijri {
  const parts = fmt.formatToParts(new Date(`${addDays(day, offset)}T00:00:00Z`))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const h = { day: get("day"), month: get("month"), year: get("year") }
  const monthName = HIJRI_MONTHS[h.month - 1] ?? ""
  return { ...h, monthName, label: `${h.day} ${monthName} ${h.year} H` }
}

export const isRamadan = (day: string, offset = 0) => toHijri(day, offset).month === 9

/** Hari yang diharamkan berpuasa: Idulfitri (1 Syawal), Iduladha & hari tasyrik (10–13 Zulhijah). */
export function isForbiddenFast(day: string, offset = 0) {
  const h = toHijri(day, offset)
  return (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13)
}

/** Jenis puasa sunnah pada tanggal tertentu (kosong jika bukan hari puasa sunnah / Ramadan / hari terlarang). */
export function sunnahFasts(day: string, offset = 0): string[] {
  const h = toHijri(day, offset)
  if (h.month === 9 || isForbiddenFast(day, offset)) return []
  const out: string[] = []
  if (h.month === 12 && h.day === 9) out.push("Arafah")
  if (h.month === 12 && h.day < 9) out.push("Awal Zulhijah")
  if (h.month === 1 && h.day === 9) out.push("Tasua")
  if (h.month === 1 && h.day === 10) out.push("Asyura")
  if (h.month === 10 && h.day >= 2 && h.day <= 7) out.push("Syawal")
  if (h.day >= 13 && h.day <= 15) out.push("Ayyamul Bidh")
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  if (weekday === 1) out.push("Senin")
  if (weekday === 4) out.push("Kamis")
  return out
}
