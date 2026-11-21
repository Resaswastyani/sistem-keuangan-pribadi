import { timingSafeEqual } from "node:crypto"
import { handleError, json } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { notifyUser } from "@/lib/notify"
import { renderPref, sisaLabel, type EffectivePref } from "@/lib/notification-prefs"
import { getPrefs, localNow } from "@/lib/prefs-server"
import { materializeRoutines } from "@/lib/routines"
import { runBudget, runDigest, runIbadah } from "@/lib/scheduled"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret") ??
    url.searchParams.get("secret") ??
    ""
  const a = Buffer.from(provided)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Dipanggil oleh cronjob. Disarankan tiap 1 menit (agar notifikasi adzan tepat waktu), minimal tiap 5 menit.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://domain-kamu/api/cron/reminders
 * Setiap notifikasi di-"claim" atomik, jadi aman walau cron berjalan tumpang-tindih.
 */
async function run(req: Request) {
  try {
    if (!authorized(req)) return json({ error: "Unauthorized" }, { status: 401 })
    const result = { reminders: 0, schedule: 0, prayer: 0, fasting: 0, digests: 0, budget: 0, pushed: 0, errors: [] as string[] }

    // 1) Pengingat custom yang jatuh tempo. Yang berulang langsung dimajukan ke jadwal berikutnya.
    const reminders = await sql`
      with due as (
        select id, remind_at as due_at from reminders
        where done = false and remind_at <= now() and (last_sent_at is null or last_sent_at < remind_at)
        order by remind_at limit 200
        for update skip locked
      )
      update reminders r set
        last_sent_at = now(),
        remind_at = case r.repeat
          when 'daily' then r.remind_at + (floor(extract(epoch from now() - r.remind_at) / 86400) + 1) * interval '1 day'
          when 'weekly' then r.remind_at + (floor(extract(epoch from now() - r.remind_at) / 604800) + 1) * interval '7 days'
          when 'monthly' then r.remind_at + ((extract(year from age(now(), r.remind_at)) * 12 + extract(month from age(now(), r.remind_at)))::int + 1) * interval '1 month'
          else r.remind_at end
      from due where r.id = due.id
      returning r.id, r.user_id, r.title, r.detail, to_char(due.due_at at time zone ${APP_TZ}, 'HH24:MI') as at`

    for (const r of reminders) {
      // Judul & isi pengingat custom ditulis sendiri oleh user.
      const { sent } = await notifyUser(r.user_id, {
        kind: "reminder",
        title: r.title,
        body: r.detail || `Pengingat pukul ${r.at}`,
        url: "/?tab=Pengingat",
        tag: `reminder-${r.id}`,
      })
      result.reminders++
      result.pushed += sent
    }

    // 2) Agenda harian yang punya "ingatkan X menit sebelum" (rutinitas mingguan disalin dulu ke hari ini).
    await materializeRoutines(localNow(APP_TZ).day)
    const items = await sql`
      with due as (
        select id from schedule_items
        where done = false and hidden = false and reminded_at is null and remind_before_min is not null
          and ((day + start_time) at time zone ${APP_TZ}) - make_interval(mins => remind_before_min) <= now()
          and ((day + start_time) at time zone ${APP_TZ}) > now() - interval '2 hours'
        limit 200
        for update skip locked
      )
      update schedule_items s set reminded_at = now()
      from due where s.id = due.id
      returning s.id, s.user_id, s.title, s.detail, to_char(s.start_time, 'HH24:MI') as start,
        ceil(extract(epoch from ((s.day + s.start_time) at time zone ${APP_TZ}) - now()) / 60)::int as mins_left,
        (select display_name from users where id = s.user_id) as display_name`

    for (const s of items) {
      const p = (await getPrefs(s.user_id)).find((x) => x.key === "schedule") as EffectivePref
      if (!p.enabled) continue
      const msg = renderPref(p, { nama: s.display_name, judul: s.title, waktu: s.start, sisa: sisaLabel(s.mins_left), detail: s.detail })
      const { sent } = await notifyUser(s.user_id, { kind: "schedule", ...msg, url: "/?tab=Jadwal", tag: `schedule-${s.id}` })
      result.schedule++
      result.pushed += sent
    }

    // 3) Sholat & puasa, 4) ringkasan malam, 5) anggaran.
    await runIbadah(result)
    await runDigest(result)
    await runBudget(result)

    // Bersih-bersih data lama.
    await sql`delete from notifications where created_at < now() - interval '90 days'`
    await sql`delete from notification_log where day < current_date - 7`

    return json({ ok: true, at: new Date().toISOString(), ...result })
  } catch (error) {
    return handleError(error)
  }
}

export const GET = run
export const POST = run
