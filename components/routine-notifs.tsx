"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Repeat, RotateCcw } from "lucide-react"
import { api } from "@/lib/client-api"
import { renderPref, sisaLabel, type EffectivePref } from "@/lib/notification-prefs"

type Routine = {
  id: string; weekday: number; startTime: string; endTime: string; title: string; detail: string
  remindBeforeMin: number | null; remindEnabled: boolean; notifyTitle: string | null; notifyBody: string | null
}
type Group = Routine & { ids: string[]; weekdays: number[] }

const SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const MON_FIRST = (d: number) => (d + 6) % 7

function daysLabel(days: number[]) {
  if (days.length === 7) return "Setiap hari"
  const sorted = [...days].sort((a, b) => MON_FIRST(a) - MON_FIRST(b))
  const idx = sorted.map(MON_FIRST)
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  return contiguous && sorted.length > 2 ? `${SHORT[sorted[0]]}–${SHORT[sorted[sorted.length - 1]]}` : sorted.map((d) => SHORT[d]).join(", ")
}

/** Notifikasi untuk tiap jadwal rutin. Rutinitas yang sama di beberapa hari (mis. Kerja Sen–Jum) diatur sekaligus. */
export function RoutineNotifs({ toast }: { toast: (t: string, b?: string) => void }) {
  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [template, setTemplate] = useState<EffectivePref | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(async () => {
    const [r, p] = await Promise.all([api<{ routines: Routine[] }>("/api/routines"), api<{ prefs: EffectivePref[] }>("/api/notification-prefs")]).catch(() => [null, null])
    if (r) setRoutines(r.routines)
    if (p) setTemplate(p.prefs.find((x) => x.key === "schedule") ?? null)
  }, [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const r of routines ?? []) {
      const key = [r.title, r.startTime, r.endTime, r.remindEnabled, r.remindBeforeMin, r.notifyTitle, r.notifyBody].join("|")
      const g = map.get(key)
      if (g) { g.ids.push(r.id); g.weekdays.push(r.weekday) } else map.set(key, { ...r, ids: [r.id], weekdays: [r.weekday] })
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || MON_FIRST(a.weekdays[0]) - MON_FIRST(b.weekdays[0]))
  }, [routines])

  if (!routines || !template) return null

  const save = async (g: Group, patch: Record<string, unknown>, msg: string) => {
    try { await api("/api/routines", { method: "PATCH", body: { ids: g.ids, ...patch } }); toast(msg); await load() } catch (e) { toast("Gagal menyimpan", (e as Error).message) }
  }

  return <section className="panel glass-panel prefs-panel">
    <div className="eyebrow"><Repeat size={11}/> JADWAL RUTIN</div><h2>Pengingat jadwal</h2>
    <p className="prefs-intro">Notifikasi untuk tiap kegiatan rutin. Jadwal yang sama di beberapa hari diatur sekaligus. Ubah jadwalnya sendiri di menu <em>Jadwal → Rutinitas mingguan</em>.</p>
    {groups.length === 0 && <p className="empty-state">Belum ada jadwal rutin.</p>}
    {groups.map((g) => <RoutineRow key={g.ids.join()} g={g} template={template} open={open === g.ids[0]} onOpen={() => setOpen(open === g.ids[0] ? null : g.ids[0])} onSave={save}/>)}
  </section>
}

function RoutineRow({ g, template, open, onOpen, onSave }: { g: Group; template: EffectivePref; open: boolean; onOpen: () => void; onSave: (g: Group, patch: Record<string, unknown>, msg: string) => Promise<void> }) {
  const active = g.remindEnabled && g.remindBeforeMin !== null
  const [minutes, setMinutes] = useState(g.remindBeforeMin ?? 10)
  const [title, setTitle] = useState(g.notifyTitle ?? "")
  const [body, setBody] = useState(g.notifyBody ?? "")
  useEffect(() => { setMinutes(g.remindBeforeMin ?? 10); setTitle(g.notifyTitle ?? ""); setBody(g.notifyBody ?? "") }, [g])

  const vars = { nama: "Resa", judul: g.title, waktu: g.startTime, sisa: sisaLabel(minutes), detail: g.detail }
  const base = { ...template, customTitle: template.customTitle, customBody: template.customBody }
  const preview = renderPref({ ...base, customTitle: title || base.customTitle, customBody: body || base.customBody }, vars)
  const current = renderPref({ ...base, customTitle: g.notifyTitle ?? base.customTitle, customBody: g.notifyBody ?? base.customBody }, { ...vars, sisa: sisaLabel(g.remindBeforeMin ?? 10) })
  const custom = Boolean(g.notifyTitle || g.notifyBody)
  const insert = (v: string) => setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}{${v}}`)

  return <div className={`pref-row ${open ? "open" : ""}`}>
    <div className="pref-head">
      <button className="pref-title" onClick={onOpen} aria-expanded={open}>
        <strong>{g.title}{custom && <span className="custom-dot">custom</span>}</strong>
        <small>{daysLabel(g.weekdays)} · {g.startTime} · {active ? `${g.remindBeforeMin === 0 ? "tepat waktu" : `${g.remindBeforeMin} menit sebelum`} · ${current.title}` : "Mati"}</small>
      </button>
      <button className={active ? "switch-on" : "switch-off"} role="switch" aria-checked={active} aria-label={`Notifikasi ${g.title}`}
        onClick={() => onSave(g, { remindEnabled: !active, ...(active ? {} : { remindBeforeMin: g.remindBeforeMin ?? 10 }) }, active ? `${g.title} dimatikan` : `${g.title} diaktifkan`)}><i/></button>
    </div>
    {open && <form className="transaction-form pref-editor" onSubmit={(e) => { e.preventDefault(); onSave(g, { remindEnabled: true, remindBeforeMin: minutes, notifyTitle: title || null, notifyBody: body || null }, "Pengingat jadwal disimpan") }}>
      <label htmlFor={`rm-${g.id}`}>Kirim</label>
      <select id={`rm-${g.id}`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[0, 5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m === 0 ? "Tepat saat mulai" : `${m} menit sebelumnya`}</option>)}</select>
      <label htmlFor={`rt-${g.id}`}>Judul notifikasi</label><input id={`rt-${g.id}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={base.customTitle || base.title}/>
      <label htmlFor={`rb-${g.id}`}>Isi pesan</label><textarea id={`rb-${g.id}`} value={body} maxLength={300} rows={3} onChange={(e) => setBody(e.target.value)} placeholder={base.customBody || base.body}/>
      <div className="var-chips">{["nama", "judul", "waktu", "sisa", "detail"].map((v) => <button type="button" key={v} onClick={() => insert(v)}>{`{${v}}`}</button>)}</div>
      <div className="notif-preview"><img src="/icons/icon-192.png" alt="" width={30} height={30}/><span><small>mellow · {sisaLabel(minutes)}</small><strong>{preview.title}</strong><span>{preview.body}</span></span></div>
      <div className="pref-actions">
        <button className="primary-button" type="submit"><Check size={14}/> Simpan & aktifkan</button>
        {custom && <button className="secondary-button" type="button" onClick={() => onSave(g, { notifyTitle: null, notifyBody: null }, "Kembali ke pesan bawaan")}><RotateCcw size={14}/> Bawaan</button>}
      </div>
    </form>}
  </div>
}
