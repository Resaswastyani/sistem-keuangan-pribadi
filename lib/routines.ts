import "server-only"
import { APP_TZ, sql } from "./db"

/**
 * Salin rutinitas mingguan menjadi agenda pada tanggal tertentu (hanya hari ini & ke depan).
 * Idempotent: unique (routine_id, day) mencegah duplikat. Agenda rutin yang "dilewati" disimpan hidden=true.
 */
export async function materializeRoutines(day: string, userId?: string) {
  await sql`
    insert into schedule_items (user_id, day, start_time, end_time, title, detail, icon, color, remind_before_min, routine_id)
    select r.user_id, ${day}::date, r.start_time, r.end_time, r.title, r.detail, r.icon, r.color, r.remind_before_min, r.id
    from routines r
    where r.active
      and r.weekday = extract(dow from ${day}::date)
      and ${day}::date >= (now() at time zone ${APP_TZ})::date
      and (${userId ?? null}::uuid is null or r.user_id = ${userId ?? null}::uuid)
    on conflict (routine_id, day) do nothing`
}
