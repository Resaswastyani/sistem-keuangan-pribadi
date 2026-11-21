"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Repeat, Trash2 } from "lucide-react"
import { api } from "@/lib/client-api"

type Routine = { id: string; weekday: number; startTime: string; endTime: string; title: string; detail: string; icon: string; color: string; remindBeforeMin: number | null }

export const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
const ORDER = [1, 2, 3, 4, 5, 6, 0] // tampil mulai Senin

/** Daftar rutinitas mingguan, dikelompokkan per hari. */
export function RoutinesPanel({ toast, onChanged, version }: { toast: (t: string, b?: string) => void; onChanged: () => void; version: number }) {
  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [day, setDay] = useState<number>(() => new Date().getDay())
  const load = useCallback(() => api<{ routines: Routine[] }>("/api/routines").then((r) => setRoutines(r.routines)).catch(() => {}), [])
  useEffect(() => { load() }, [load, version])
  if (!routines) return null

  const remove = async (r: Routine) => {
    if (!confirm(`Hapus rutinitas “${r.title}” setiap ${WEEKDAYS[r.weekday]}?`)) return
    try { await api(`/api/routines/${r.id}`, { method: "DELETE" }); toast("Rutinitas dihapus"); load(); onChanged() } catch (e) { toast("Gagal", (e as Error).message) }
  }
  const list = routines.filter((r) => r.weekday === day)

  return <section className="panel glass-panel routines-panel">
    <div className="calendar-top"><div><div className="eyebrow"><Repeat size={11}/> RUTINITAS MINGGUAN</div><h2>Ritme tiap minggu</h2></div><span className="tiny-count">{routines.length}</span></div>
    <p className="prefs-intro">Otomatis masuk ke agenda setiap minggu, lengkap dengan pengingatnya. Hapus agenda di hari tertentu = dilewati hari itu saja.</p>
    <div className="weekday-tabs">{ORDER.map((d) => { const n = routines.filter((r) => r.weekday === d).length; return <button key={d} className={d === day ? "active" : ""} onClick={() => setDay(d)}>{WEEKDAYS[d].slice(0, 3)}{n > 0 && <i>{n}</i>}</button> })}</div>
    {list.length === 0 ? <p className="empty-state">Belum ada rutinitas di hari {WEEKDAYS[day]}.</p> :
      <div className="routine-list">{list.map((r) => <div key={r.id} className="routine-row"><span className={`routine-dot ${r.color}`}/><span className="routine-time">{r.startTime}–{r.endTime}</span><span className="routine-copy"><strong>{r.title}</strong>{r.detail && <small>{r.detail}</small>}</span>{r.remindBeforeMin !== null && <span className="routine-bell" title={`Ingatkan ${r.remindBeforeMin} menit sebelum`}><Bell size={11}/>{r.remindBeforeMin}′</span>}<button className="mini-delete" aria-label={`Hapus ${r.title}`} onClick={() => remove(r)}><Trash2 size={13}/></button></div>)}</div>}
  </section>
}
