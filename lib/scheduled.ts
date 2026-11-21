import "server-only"
import { APP_TZ, sql } from "./db"
import { addDays, isRamadan, sunnahFasts, toHijri } from "./hijri"
import { notifyUser } from "./notify"
import { renderPref, sisaLabel, type EffectivePref } from "./notification-prefs"
import { getPrayerTimes, type PrayerDay } from "./prayer"
import { claimSlot, getPrefs, localNow, toMinutes } from "./prefs-server"

/** Notifikasi yang terlambat lebih dari ini (mis. cron sempat mati) tidak dikirim lagi. */
const LATE_WINDOW_MIN = 20

export const money = (v: number) => `Rp ${Math.abs(Math.round(v)).toLocaleString("id-ID")}`
const PRAYER_LABEL: Record<string, string> = { subuh: "Subuh", dhuha: "Dhuha", dzuhur: "Dzuhur", ashar: "Ashar", maghrib: "Maghrib", isya: "Isya" }
const cityLabel = (name: string) => name.replace(/^KAB\.\s*/i, "").replace(/^KOTA\s*/i, "Kota ").toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())

type UserRow = { id: string; display_name: string; city_id: string; city_name: string; hijri_offset: number }
type Candidate = { key: string; target: number; event: number; time: string; vars?: Record<string, string> }

/** Variabel untuk pesan sholat/puasa. Dipakai cron dan tombol "uji". */
export function prayerVars(user: Pick<UserRow, "display_name" | "city_name">, key: string, time: string, minsLeft: number, hijriLabel: string) {
  return { nama: user.display_name, sholat: PRAYER_LABEL[key] ?? key, waktu: time, sisa: sisaLabel(minsLeft), kota: cityLabel(user.city_name), tanggal_hijriah: hijriLabel }
}

export async function runIbadah(result: { prayer: number; fasting: number; pushed: number; errors: string[] }) {
  const { day: today, minutes: nowMin } = localNow(APP_TZ)
  const tomorrow = addDays(today, 1)
  const users = (await sql`select id, display_name, city_id, city_name, hijri_offset from users`) as UserRow[]

  for (const u of users) {
    let times: PrayerDay | undefined
    try {
      times = (await getPrayerTimes(u.city_id, u.city_name, today, today))[0]
    } catch (error) {
      result.errors.push(`jadwal ${u.city_name}: ${(error as Error).message}`)
      continue
    }
    if (!times) continue

    const prefs = await getPrefs(u.id)
    const pref = (k: string) => prefs.find((p) => p.key === k) as EffectivePref
    const hijri = toHijri(today, u.hijri_offset)
    const [planned] = await sql`select status from fasting_log where user_id = ${u.id} and day = ${today}::date and status in ('planned','done')`
    const fastingToday = isRamadan(today, u.hijri_offset) || Boolean(planned)

    const candidates: Candidate[] = []
    for (const key of ["subuh", "dhuha", "dzuhur", "ashar", "maghrib", "isya"] as const) {
      const p = pref(key)
      if (p?.enabled) candidates.push({ key, event: toMinutes(times[key]), target: toMinutes(times[key]) - (p.beforeMin ?? 0), time: times[key] })
    }
    if (fastingToday) {
      for (const [key, base] of [["sahur", times.imsak], ["imsak", times.imsak], ["buka", times.maghrib]] as const) {
        const p = pref(key)
        if (p?.enabled) candidates.push({ key, event: toMinutes(base), target: toMinutes(base) - (p.beforeMin ?? 0), time: base })
      }
    }
    const sunnah = pref("puasa_sunnah")
    const tomorrowTypes = sunnahFasts(tomorrow, u.hijri_offset)
    if (sunnah?.enabled && sunnah.atTime && tomorrowTypes.length && !isRamadan(tomorrow, u.hijri_offset)) {
      candidates.push({ key: "puasa_sunnah", event: toMinutes(sunnah.atTime), target: toMinutes(sunnah.atTime), time: sunnah.atTime,
        vars: { nama: u.display_name, jenis: tomorrowTypes.join(" & "), tanggal_hijriah: toHijri(tomorrow, u.hijri_offset).label } })
    }

    for (const c of candidates) {
      const late = nowMin - c.target
      if (late < 0 || late >= LATE_WINDOW_MIN) continue
      if (!(await claimSlot(u.id, c.key, today))) continue
      const vars = c.vars ?? prayerVars(u, c.key, c.time, c.event - nowMin, hijri.label)
      const msg = renderPref(pref(c.key), vars)
      const isFasting = ["sahur", "imsak", "buka", "puasa_sunnah"].includes(c.key)
      const { sent } = await notifyUser(u.id, { kind: isFasting ? "fasting" : "prayer", ...msg, url: "/?tab=Ibadah", tag: `${c.key}-${today}` })
      if (isFasting) result.fasting++
      else result.prayer++
      result.pushed += sent
    }
  }
}

/** Ringkasan malam pada jam yang dipilih user (bawaan 20.00). */
export async function runDigest(result: { digests: number; pushed: number }) {
  const { day: today, minutes: nowMin } = localNow(APP_TZ)
  const users = await sql`select id, display_name from users`
  for (const u of users) {
    const p = (await getPrefs(u.id)).find((x) => x.key === "digest") as EffectivePref
    if (!p.enabled || !p.atTime || nowMin < toMinutes(p.atTime)) continue
    if (!(await claimSlot(u.id, "digest", today))) continue
    const [s] = await sql`
      select
        (select count(*)::int from transactions t where t.user_id = ${u.id} and (t.occurred_at at time zone ${APP_TZ})::date = ${today}::date) as tx_count,
        (select coalesce(-sum(amount), 0)::bigint from transactions t where t.user_id = ${u.id} and t.amount < 0 and t.goal_id is null and (t.occurred_at at time zone ${APP_TZ})::date = ${today}::date) as spent,
        (select count(*)::int from schedule_items s where s.user_id = ${u.id} and s.day = ${today}::date + 1) as tomorrow`
    const ringkasan =
      (s.tx_count === 0 ? "Belum ada catatan uang hari ini. Yuk catat sebentar sebelum tidur 💸" : `Hari ini kamu mencatat ${s.tx_count} transaksi, pengeluaran ${money(Number(s.spent))}.`) +
      (s.tomorrow > 0 ? ` Besok ada ${s.tomorrow} agenda.` : "")
    const msg = renderPref(p, { nama: u.display_name, ringkasan, jumlah_transaksi: s.tx_count, pengeluaran: money(Number(s.spent)), agenda_besok: s.tomorrow })
    const { sent } = await notifyUser(u.id, { kind: "digest", ...msg, url: "/?tab=Keuangan", tag: "daily-digest" })
    result.digests++
    result.pushed += sent
  }
}

/** Peringatan anggaran 80% & 100%, sekali per level per bulan. */
export async function runBudget(result: { budget: number; pushed: number }) {
  const budgets = await sql`
    select u.id, u.display_name, u.monthly_budget, u.budget_alert_on, to_char(now() at time zone ${APP_TZ}, 'YYYY-MM') as month,
      coalesce((select -sum(amount) from transactions t where t.user_id = u.id and t.amount < 0 and t.goal_id is null
        and (t.occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ})), 0)::bigint as spent
    from users u where u.monthly_budget > 0`
  for (const b of budgets) {
    const pctUsed = (Number(b.spent) / Number(b.monthly_budget)) * 100
    const level = pctUsed >= 100 ? 100 : pctUsed >= 80 ? 80 : 0
    if (!level) continue
    const key = `${b.month}:${level}`
    const prev = String(b.budget_alert_on ?? "")
    if (prev === key || (level === 80 && prev === `${b.month}:100`)) continue
    const p = (await getPrefs(b.id)).find((x) => x.key === "budget") as EffectivePref
    const [claimed] = await sql`update users set budget_alert_on = ${key} where id = ${b.id} and budget_alert_on is not distinct from ${b.budget_alert_on} returning id`
    if (!claimed || !p.enabled) continue
    const msg = renderPref(p, { nama: b.display_name, persen: Math.round(pctUsed), terpakai: money(Number(b.spent)), anggaran: money(Number(b.monthly_budget)) })
    const { sent } = await notifyUser(b.id, { kind: "budget", ...msg, url: "/?tab=Keuangan", tag: "budget-alert" })
    result.budget++
    result.pushed += sent
  }
}
