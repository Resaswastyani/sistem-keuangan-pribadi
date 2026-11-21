import "server-only"
import { sql } from "./db"
import { mergePrefs, type EffectivePref } from "./notification-prefs"

export async function getPrefs(userId: string): Promise<EffectivePref[]> {
  const rows = await sql`
    select key, enabled, before_min, to_char(at_time, 'HH24:MI') as at_time, title, body
    from notification_prefs where user_id = ${userId}`
  return mergePrefs(rows.map((r) => ({ key: r.key, enabled: r.enabled, beforeMin: r.before_min, atTime: r.at_time, title: r.title, body: r.body })))
}

/** Tanggal & menit-dalam-hari sekarang di zona waktu aplikasi. */
export function localNow(tz: string, at = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at)
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(at).split(":").map(Number)
  return { day, minutes: (h % 24) * 60 + m }
}

export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Klaim slot notifikasi (user, key, hari). true = belum pernah terkirim, boleh kirim sekarang. */
export async function claimSlot(userId: string, key: string, day: string) {
  const rows = await sql`insert into notification_log (user_id, key, day) values (${userId}, ${key}, ${day}::date) on conflict do nothing returning key`
  return rows.length > 0
}
