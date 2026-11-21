import { timingSafeEqual } from "node:crypto"
import { handleError, json } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"
import { notifyUser } from "@/lib/notify"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const money = (v: number) => `Rp ${Math.abs(v).toLocaleString("id-ID")}`

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
 * Dipanggil oleh cronjob (disarankan tiap 5 menit).
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://domain-kamu/api/cron/reminders
 * Setiap pengingat hanya dikirim sekali (di-"claim" atomik dengan UPDATE ... RETURNING),
 * jadi aman walau cron berjalan tumpang-tindih.
 */
async function run(req: Request) {
  try {
    if (!authorized(req)) return json({ error: "Unauthorized" }, { status: 401 })
    const result = { reminders: 0, schedule: 0, digests: 0, budget: 0, pushed: 0 }

    // 1) Pengingat yang sudah jatuh tempo. Yang berulang langsung dimajukan ke jadwal berikutnya.
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
      const { sent } = await notifyUser(r.user_id, {
        kind: "reminder",
        title: `⏰ ${r.title}`,
        body: r.detail ? `${r.at} · ${r.detail}` : `Pengingat pukul ${r.at}`,
        url: "/?tab=Pengingat",
        tag: `reminder-${r.id}`,
      })
      result.reminders++
      result.pushed += sent
    }

    // 2) Agenda harian yang punya "ingatkan X menit sebelum".
    const items = await sql`
      with due as (
        select id from schedule_items
        where done = false and reminded_at is null and remind_before_min is not null
          and ((day + start_time) at time zone ${APP_TZ}) - make_interval(mins => remind_before_min) <= now()
          and ((day + start_time) at time zone ${APP_TZ}) > now() - interval '2 hours'
        limit 200
        for update skip locked
      )
      update schedule_items s set reminded_at = now()
      from due where s.id = due.id
      returning s.id, s.user_id, s.title, s.detail, to_char(s.start_time, 'HH24:MI') as start,
        ceil(extract(epoch from ((s.day + s.start_time) at time zone ${APP_TZ}) - now()) / 60)::int as mins_left`

    for (const s of items) {
      const lead = s.mins_left > 0 ? `${s.mins_left} menit lagi` : "sekarang"
      const { sent } = await notifyUser(s.user_id, {
        kind: "schedule",
        title: `📅 ${s.title} · ${s.start}`,
        body: `Mulai ${lead}${s.detail ? ` — ${s.detail}` : ""}`,
        url: "/?tab=Jadwal",
        tag: `schedule-${s.id}`,
      })
      result.schedule++
      result.pushed += sent
    }

    // 3) Ringkasan malam (setelah 20.00 waktu lokal), sekali per hari.
    const digests = await sql`
      update users u set daily_digest_on = (now() at time zone ${APP_TZ})::date
      where extract(hour from now() at time zone ${APP_TZ}) >= 20
        and u.daily_digest_on is distinct from (now() at time zone ${APP_TZ})::date
      returning u.id, u.display_name,
        (select count(*)::int from transactions t where t.user_id = u.id and (t.occurred_at at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date) as tx_count,
        (select coalesce(-sum(amount), 0)::bigint from transactions t where t.user_id = u.id and t.amount < 0 and t.goal_id is null and (t.occurred_at at time zone ${APP_TZ})::date = (now() at time zone ${APP_TZ})::date) as spent,
        (select count(*)::int from schedule_items s where s.user_id = u.id and s.day = (now() at time zone ${APP_TZ})::date + 1) as tomorrow`

    for (const d of digests) {
      const body =
        d.tx_count === 0
          ? "Belum ada catatan uang hari ini. Yuk catat sebentar sebelum tidur 💸"
          : `Hari ini kamu mencatat ${d.tx_count} transaksi, pengeluaran ${money(Number(d.spent))}.`
      const { sent } = await notifyUser(d.id, {
        kind: "digest",
        title: `🌙 Ringkasan hari ini, ${d.display_name}`,
        body: d.tomorrow > 0 ? `${body} Besok ada ${d.tomorrow} agenda.` : body,
        url: "/?tab=Keuangan",
        tag: "daily-digest",
      })
      result.digests++
      result.pushed += sent
    }

    // 4) Peringatan anggaran bulanan (80% dan 100%), sekali per level per bulan.
    const budgets = await sql`
      select u.id, u.monthly_budget, u.budget_alert_on, to_char(now() at time zone ${APP_TZ}, 'YYYY-MM') as month,
        coalesce((select -sum(amount) from transactions t where t.user_id = u.id and t.amount < 0 and t.goal_id is null
          and (t.occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ})), 0)::bigint as spent
      from users u where u.monthly_budget > 0`

    for (const b of budgets) {
      const pct = (Number(b.spent) / Number(b.monthly_budget)) * 100
      const level = pct >= 100 ? 100 : pct >= 80 ? 80 : 0
      if (!level) continue
      const key = `${b.month}:${level}`
      const prev = String(b.budget_alert_on ?? "")
      if (prev === key || (level === 80 && prev === `${b.month}:100`)) continue
      const [claimed] = await sql`update users set budget_alert_on = ${key} where id = ${b.id} and budget_alert_on is not distinct from ${b.budget_alert_on} returning id`
      if (!claimed) continue
      const { sent } = await notifyUser(b.id, {
        kind: "budget",
        title: level === 100 ? "⚠️ Anggaran bulan ini habis" : "💡 Anggaran sudah 80%",
        body: `Pengeluaran ${money(Number(b.spent))} dari ${money(Number(b.monthly_budget))}. Pelan-pelan ya.`,
        url: "/?tab=Keuangan",
        tag: "budget-alert",
      })
      result.budget++
      result.pushed += sent
    }

    // Bersih-bersih data lama.
    await sql`delete from notifications where created_at < now() - interval '90 days'`

    return json({ ok: true, at: new Date().toISOString(), ...result })
  } catch (error) {
    return handleError(error)
  }
}

export const GET = run
export const POST = run
