"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, MapPin, Moon, MoonStar, RotateCcw, Search, Send, Sparkles, Sunrise, Sunset, X } from "lucide-react"
import { api } from "@/lib/client-api"
import { addDays } from "@/lib/hijri"
import { renderPref, sisaLabel, type EffectivePref, type PrefGroup } from "@/lib/notification-prefs"

type Times = { day: string; imsak: string; subuh: string; terbit: string; dhuha: string; dzuhur: string; ashar: string; maghrib: string; isya: string }
type IbadahData = {
  city: { id: string; name: string }
  hijriOffset: number
  today: string
  nowMinutes: number
  hijriToday: { label: string; month: number; day: number }
  ramadanToday: boolean
  sunnahToday: string[]
  sunnahTomorrow: string[]
  times: { today: Times | null; tomorrow: Times | null }
  month: string
  monthTimes: (Times & { hijri: string; sunnah: string[] })[]
  prayerError: string | null
  fasting: { day: string; kind: "ramadan" | "sunnah" | "qadha" | "nazar"; status: "planned" | "done" | "missed" }[]
  recap: { ramadanDone: number; ramadanMissed: number; qadhaDone: number; sunnahDone: number; qadhaOwed: number }
  upcoming: { day: string; hijri: string; types: string[]; ramadan: boolean }[]
  prefs: EffectivePref[]
}

const ROWS: { key: keyof Times; label: string; prayer: boolean }[] = [
  { key: "imsak", label: "Imsak", prayer: false }, { key: "subuh", label: "Subuh", prayer: true }, { key: "terbit", label: "Terbit", prayer: false },
  { key: "dhuha", label: "Dhuha", prayer: true }, { key: "dzuhur", label: "Dzuhur", prayer: true }, { key: "ashar", label: "Ashar", prayer: true },
  { key: "maghrib", label: "Maghrib", prayer: true }, { key: "isya", label: "Isya", prayer: true },
]
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const nowMinutes = () => { const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":").map(Number); return (h % 24) * 60 + m }
const dayName = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))
const cityLabel = (n: string) => n.replace(/^KAB\.\s*/i, "").replace(/^KOTA\s*/i, "Kota ").toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase())
const KIND_LABEL = { ramadan: "Ramadan", sunnah: "Sunnah", qadha: "Qadha", nazar: "Nazar" }

export function IbadahPage({ toast }: { toast: (title: string, body?: string) => void }) {
  const [data, setData] = useState<IbadahData | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [now, setNow] = useState(nowMinutes())
  const [cityOpen, setCityOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api<IbadahData>(`/api/ibadah${month ? `?month=${month}` : ""}`))
      setError("")
    } catch (e) { setError((e as Error).message) }
  }, [month])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(() => setNow(nowMinutes()), 20_000); return () => clearInterval(t) }, [])

  const next = useMemo(() => {
    if (!data?.times.today) return null
    const list = ROWS.filter((r) => r.prayer && r.key !== "dhuha").map((r) => ({ ...r, time: data.times.today![r.key] as string, tomorrow: false }))
    const upcoming = list.find((r) => toMin(r.time) > now)
    if (upcoming) return { ...upcoming, mins: toMin(upcoming.time) - now }
    const subuh = data.times.tomorrow?.subuh
    return subuh ? { key: "subuh" as const, label: "Subuh", prayer: true, time: subuh, tomorrow: true, mins: 24 * 60 - now + toMin(subuh) } : null
  }, [data, now])

  if (!data) return <div className="panel glass-panel empty-state">{error ? <>Gagal memuat: {error} <button className="text-link" onClick={load}>Coba lagi</button></> : "Memuat jadwal sholat…"}</div>

  const fastToday = data.fasting.find((f) => f.day === data.today)
  const tomorrow = addDays(data.today, 1)
  const fastTomorrow = data.fasting.find((f) => f.day === tomorrow)
  const setFast = async (day: string, kind: IbadahData["fasting"][number]["kind"], status: "planned" | "done" | "missed", msg: string) => {
    try { await api("/api/ibadah/fasting", { method: "PUT", body: { day, kind, status } }); toast(msg); load() } catch (e) { toast("Gagal", (e as Error).message) }
  }
  const clearFast = async (day: string) => { try { await api("/api/ibadah/fasting", { method: "DELETE", body: { day } }); load() } catch (e) { toast("Gagal", (e as Error).message) } }
  const kindFor = (day: string, ramadan: boolean) => (ramadan ? "ramadan" : data.fasting.find((f) => f.day === day)?.kind ?? "sunnah")
  const monthLabel = dayName(`${data.month}-01`, { month: "long", year: "numeric" })
  const prefEnabled = (key: string) => data.prefs.find((p) => p.key === key)?.enabled

  return <>
    <div className="greeting-row page-heading"><div><div className="eyebrow"><MoonStar size={12}/> {data.hijriToday.label.toUpperCase()}</div><h1>Ibadah</h1><p className="page-subtitle">Jadwal sholat & puasa sesuai Kemenag RI, dengan pengingat yang kamu atur sendiri.</p></div>
      <button className="primary-button" onClick={() => setCityOpen(true)}><MapPin size={16}/> {cityLabel(data.city.name)}</button></div>

    {data.prayerError && <div className="install-hint glass-panel"><BellOff size={18}/><span><strong>Jadwal belum tersedia</strong><small>{data.prayerError}</small></span></div>}

    <section className="ibadah-top">
      <article className="panel glass-panel next-prayer">
        <div className="eyebrow">SHOLAT BERIKUTNYA · {cityLabel(data.city.name).toUpperCase()}</div>
        {next ? <><h2>{next.label} <span>{next.time}</span></h2><p>{next.tomorrow ? "Besok · " : ""}{sisaLabel(next.mins)}</p></> : <h2>—</h2>}
        {data.ramadanToday && <span className="ramadan-badge"><Moon size={13}/> Ramadan · hari ke-{data.hijriToday.day}</span>}
      </article>
      <article className="panel glass-panel prayer-grid">
        {data.times.today ? ROWS.map((r) => { const t = data.times.today![r.key] as string; const passed = toMin(t) <= now; const isNext = next && !next.tomorrow && next.key === r.key
          return <div key={r.key} className={`prayer-cell ${isNext ? "is-next" : ""} ${passed ? "passed" : ""}`}><span>{r.label}</span><strong>{t}</strong>{r.prayer && (prefEnabled(r.key) ? <Bell size={11} aria-label="Pengingat aktif"/> : <BellOff size={11} aria-label="Pengingat mati"/>)}</div> }) : <p className="empty-state">Tidak ada data hari ini.</p>}
      </article>
    </section>

    <section className="ibadah-grid">
      <article className="panel glass-panel fasting-card">
        <div className="eyebrow">PUASA HARI INI</div>
        <h2>{data.ramadanToday ? "Puasa Ramadan" : data.sunnahToday.length ? `Sunnah ${data.sunnahToday.join(" & ")}` : "Tidak ada puasa khusus"}</h2>
        {data.times.today && <p className="fasting-times"><Sunrise size={14}/> Imsak {data.times.today.imsak} <Sunset size={14}/> Berbuka {data.times.today.maghrib}</p>}
        {fastToday ? <div className="fast-status"><span className={`chip chip-${fastToday.status}`}>{fastToday.status === "done" ? "✓ Selesai" : fastToday.status === "missed" ? "Batal / tidak puasa" : "Sedang puasa"} · {KIND_LABEL[fastToday.kind]}</span>
          <div className="fast-actions">{fastToday.status !== "done" && <button className="secondary-button" onClick={() => setFast(data.today, fastToday.kind, "done", "Alhamdulillah, puasa tercatat ✓")}><Check size={14}/> Selesai</button>}{fastToday.status !== "missed" && <button className="secondary-button" onClick={() => setFast(data.today, fastToday.kind, "missed", "Dicatat tidak puasa")}>Batal</button>}<button className="mini-delete" aria-label="Hapus catatan" onClick={() => clearFast(data.today)}><X size={14}/></button></div></div>
          : <div className="fast-actions">
            <button className="secondary-button" onClick={() => setFast(data.today, data.ramadanToday ? "ramadan" : "sunnah", "planned", "Bismillah, semangat puasanya!")}><Moon size={14}/> Aku puasa hari ini</button>
            {!data.ramadanToday && <button className="secondary-button" onClick={() => setFast(data.today, "qadha", "planned", "Puasa qadha dicatat")}>Puasa qadha</button>}
            {data.ramadanToday && <button className="secondary-button" onClick={() => setFast(data.today, "ramadan", "missed", "Dicatat sebagai utang puasa")}>Tidak puasa</button>}
          </div>}
        <div className="fast-tomorrow"><span><strong>Besok</strong><small>{data.sunnahTomorrow.length ? `Puasa ${data.sunnahTomorrow.join(" & ")}` : "Tidak ada puasa sunnah khusus"}</small></span>
          {fastTomorrow ? <span className="chip chip-planned">Direncanakan · {KIND_LABEL[fastTomorrow.kind]}</span> : <button className="text-link" onClick={() => setFast(tomorrow, data.upcoming.find((u) => u.day === tomorrow)?.ramadan ? "ramadan" : "sunnah", "planned", "Puasa besok direncanakan. Pengingat sahur akan dikirim 🌙")}>Rencanakan <Bell size={12}/></button>}</div>
        <small className="form-hint">Hari yang “direncanakan” / Ramadan otomatis mendapat pengingat sahur, imsak & berbuka.</small>
      </article>

      <article className="panel glass-panel">
        <div className="eyebrow">REKAP 12 BULAN</div><h2>Catatan puasa</h2>
        <div className="recap-grid"><div><strong>{data.recap.ramadanDone}</strong><span>Ramadan</span></div><div><strong>{data.recap.sunnahDone}</strong><span>Sunnah</span></div><div><strong>{data.recap.qadhaDone}</strong><span>Qadha dibayar</span></div><div className={data.recap.qadhaOwed ? "owed" : ""}><strong>{data.recap.qadhaOwed}</strong><span>Utang puasa</span></div></div>
        <div className="eyebrow space-top">PUASA SUNNAH MENDATANG</div>
        <div className="upcoming-list">{data.upcoming.filter((u) => u.day > data.today).slice(0, 8).map((u) => { const f = data.fasting.find((x) => x.day === u.day)
          return <div key={u.day} className="upcoming-row"><span><strong>{dayName(u.day, { weekday: "short", day: "numeric", month: "short" })}</strong><small>{u.ramadan ? "Ramadan" : u.types.join(" & ")} · {u.hijri}</small></span>{f ? <button className="chip chip-planned" onClick={() => clearFast(u.day)} title="Batalkan rencana">✓ {KIND_LABEL[f.kind]}</button> : <button className="text-link" onClick={() => setFast(u.day, kindFor(u.day, u.ramadan), "planned", "Direncanakan 🌙")}>Rencanakan</button>}</div> })}</div>
      </article>
    </section>

    <section className="panel glass-panel month-panel">
      <div className="calendar-top"><div><div className="eyebrow">JADWAL BULANAN · KEMENAG RI</div><h2>{monthLabel}</h2></div><div className="day-nav"><button className="period-select" aria-label="Bulan sebelumnya" onClick={() => setMonth(addDays(`${data.month}-01`, -1).slice(0, 7))}><ChevronLeft size={14}/></button><button className="period-select" onClick={() => setMonth(null)}>Bulan ini</button><button className="period-select" aria-label="Bulan berikutnya" onClick={() => setMonth(addDays(`${data.month}-01`, 32).slice(0, 7))}><ChevronRight size={14}/></button></div></div>
      <div className="month-table-wrap"><table className="month-table"><thead><tr><th>Tanggal</th>{ROWS.map((r) => <th key={r.key}>{r.label}</th>)}</tr></thead>
        <tbody>{data.monthTimes.map((t) => <tr key={t.day} className={t.day === data.today ? "is-today" : ""}><td><strong>{dayName(t.day, { weekday: "short", day: "numeric" })}</strong><small>{t.hijri.replace(/ \d+ H$/, "")}{t.sunnah.length ? ` · ${t.sunnah[0]}` : ""}</small></td>{ROWS.map((r) => <td key={r.key}>{t[r.key]}</td>)}</tr>)}</tbody></table></div>
    </section>

    <NotificationPrefs groups={["sholat", "puasa"]} toast={toast} title="Pengingat sholat & puasa" onSaved={load}/>

    {cityOpen && <CityDialog current={data.city} offset={data.hijriOffset} hijri={data.hijriToday.label} onClose={() => setCityOpen(false)} onSaved={() => { setCityOpen(false); toast("Pengaturan ibadah disimpan"); load() }}/>}
  </>
}

function CityDialog({ current, offset, hijri, onClose, onSaved }: { current: { id: string; name: string }; offset: number; hijri: string; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState(current)
  const [hijriOffset, setHijriOffset] = useState(offset)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const search = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("")
    try { const r = await api<{ cities: { id: string; name: string }[] }>(`/api/ibadah/cities?q=${encodeURIComponent(q)}`); setResults(r.cities); if (!r.cities.length) setErr("Kota tidak ditemukan.") } catch (e) { setErr((e as Error).message) }
  }
  const save = async () => {
    setBusy(true)
    try { await api("/api/ibadah/settings", { method: "PATCH", body: { ...(picked.id !== current.id ? { cityId: picked.id, cityName: picked.name } : {}), hijriOffset } }); onSaved() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return <div className="dialog-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="dialog-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="city-title">
    <button className="dialog-close" aria-label="Tutup" onClick={onClose}><X size={18}/></button>
    <div className="eyebrow">LOKASI & KALENDER</div><h2 id="city-title">Pengaturan ibadah</h2><p>Lokasi sekarang: <strong>{cityLabel(picked.name)}</strong></p>
    <form className="transaction-form" onSubmit={search}>
      <label htmlFor="city-q">Cari kabupaten / kota</label>
      <div className="search-row"><input id="city-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contoh: Boyolali, Solo, Semarang" minLength={3} required/><button className="secondary-button" type="submit"><Search size={14}/></button></div>
      {results.length > 0 && <div className="city-results">{results.map((c) => <button type="button" key={c.id} className={c.id === picked.id ? "picked" : ""} onClick={() => setPicked(c)}><MapPin size={12}/> {cityLabel(c.name)}</button>)}</div>}
      <label htmlFor="hijri-off">Koreksi tanggal Hijriah</label>
      <select id="hijri-off" value={hijriOffset} onChange={(e) => setHijriOffset(Number(e.target.value))}><option value={-2}>−2 hari</option><option value={-1}>−1 hari</option><option value={0}>Tanpa koreksi</option><option value={1}>+1 hari</option><option value={2}>+2 hari</option></select>
      <small className="form-hint">Hari ini: {hijri} (sebelum perubahan). Sesuaikan dengan hasil sidang isbat bila awal Ramadan/Syawal berbeda.</small>
      {err && <span className="form-error">{err}</span>}
      <button className="primary-button" type="button" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</button>
    </form>
  </section></div>
}

const SAMPLE: Record<string, Record<string, string>> = {
  _prayer: { nama: "Queens", sholat: "Dzuhur", waktu: "11:27", sisa: "sekarang", kota: "Boyolali", tanggal_hijriah: "11 Jumadil Akhir 1448 H" },
  puasa_sunnah: { nama: "Queens", jenis: "Senin", tanggal_hijriah: "12 Jumadil Akhir 1448 H" },
  digest: { nama: "Queens", ringkasan: "Hari ini kamu mencatat 3 transaksi, pengeluaran Rp 75.000.", jumlah_transaksi: "3", pengeluaran: "Rp 75.000", agenda_besok: "2" },
  budget: { nama: "Queens", persen: "80", terpakai: "Rp 960.000", anggaran: "Rp 1.200.000" },
  schedule: { nama: "Queens", judul: "Belajar", waktu: "19:00", sisa: "10 menit lagi", detail: "Bab 3" },
}

/** Daftar notifikasi otomatis + editor pesan custom. Dipakai di menu Ibadah dan Pengaturan. */
export function NotificationPrefs({ groups, toast, title, onSaved }: { groups: PrefGroup[]; toast: (t: string, b?: string) => void; title: string; onSaved?: () => void }) {
  const [prefs, setPrefs] = useState<EffectivePref[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const load = useCallback(() => api<{ prefs: EffectivePref[] }>("/api/notification-prefs").then((r) => setPrefs(r.prefs)).catch(() => {}), [])
  useEffect(() => { load() }, [load])
  if (!prefs) return null
  const save = async (p: EffectivePref, patch: Partial<{ enabled: boolean; beforeMin: number; atTime: string; title: string | null; body: string | null }>, msg?: string) => {
    try {
      await api("/api/notification-prefs", { method: "PUT", body: { key: p.key, enabled: p.enabled, beforeMin: p.beforeMin ?? undefined, atTime: p.atTime ?? undefined, title: p.customTitle, body: p.customBody, ...patch } })
      if (msg) toast(msg)
      await load(); onSaved?.()
    } catch (e) { toast("Gagal menyimpan", (e as Error).message) }
  }
  return <section className="panel glass-panel prefs-panel">
    <div className="eyebrow">NOTIFIKASI OTOMATIS</div><h2>{title}</h2>
    <p className="prefs-intro">Tulis pesanmu sendiri, misalnya <em>“Res jangan lupa sholat {"{sholat}"} dulu ya 🤍”</em>. Kata dalam kurung kurawal diganti otomatis.</p>
    {groups.map((g) => <div key={g} className="pref-group"><div className="side-label">{g === "sholat" ? "SHOLAT" : g === "puasa" ? "PUASA" : "LAINNYA"}</div>
      {prefs.filter((p) => p.group === g).map((p) => <PrefRow key={p.key} p={p} open={open === p.key} onOpen={() => setOpen(open === p.key ? null : p.key)} onSave={save} toast={toast}/>)}
    </div>)}
  </section>
}

function PrefRow({ p, open, onOpen, onSave, toast }: { p: EffectivePref; open: boolean; onOpen: () => void; onSave: (p: EffectivePref, patch: Record<string, unknown>, msg?: string) => Promise<void>; toast: (t: string, b?: string) => void }) {
  const [title, setTitle] = useState(p.customTitle ?? "")
  const [body, setBody] = useState(p.customBody ?? "")
  const [beforeMin, setBeforeMin] = useState(p.beforeMin ?? 0)
  const [atTime, setAtTime] = useState(p.atTime ?? "20:00")
  useEffect(() => { setTitle(p.customTitle ?? ""); setBody(p.customBody ?? ""); setBeforeMin(p.beforeMin ?? 0); setAtTime(p.atTime ?? "20:00") }, [p])
  const sample = { ...(SAMPLE[p.key] ?? { ...SAMPLE._prayer, sholat: p.label, sisa: sisaLabel(beforeMin) }) }
  const preview = renderPref({ ...p, customTitle: title || null, customBody: body || null }, sample)
  const custom = Boolean(p.customTitle || p.customBody)
  const timing = p.beforeMin !== null ? (p.beforeMin === 0 ? "Tepat waktu" : `${p.beforeMin} menit sebelum`) : p.atTime ? `Jam ${p.atTime}` : p.hint
  const insert = (v: string) => setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}{${v}}`)

  return <div className={`pref-row ${open ? "open" : ""}`}>
    <div className="pref-head"><button className="pref-title" onClick={onOpen} aria-expanded={open}><strong>{p.label}{custom && <span className="custom-dot">custom</span>}</strong><small>{p.enabled ? timing : "Mati"} · {renderPref(p, sample).title}</small></button>
      <button className={p.enabled ? "switch-on" : "switch-off"} role="switch" aria-checked={p.enabled} aria-label={`Notifikasi ${p.label}`} onClick={() => onSave(p, { enabled: !p.enabled }, p.enabled ? `${p.label} dimatikan` : `${p.label} diaktifkan`)}><i/></button></div>
    {open && <form className="transaction-form pref-editor" onSubmit={(e) => { e.preventDefault(); onSave(p, { title: title || null, body: body || null, beforeMin, atTime }, "Pesan disimpan") }}>
      {p.beforeMin !== null && <><label htmlFor={`b-${p.key}`}>Kirim</label><select id={`b-${p.key}`} value={beforeMin} onChange={(e) => setBeforeMin(Number(e.target.value))}>{[0, 5, 10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m === 0 ? "Tepat waktu" : `${m} menit sebelumnya`}</option>)}</select></>}
      {p.atTime !== null && <><label htmlFor={`t-${p.key}`}>Jam kirim</label><input id={`t-${p.key}`} type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)}/></>}
      <label htmlFor={`ti-${p.key}`}>Judul notifikasi</label><input id={`ti-${p.key}`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={p.title}/>
      <label htmlFor={`bo-${p.key}`}>Isi pesan</label><textarea id={`bo-${p.key}`} value={body} maxLength={300} rows={3} onChange={(e) => setBody(e.target.value)} placeholder={p.body}/>
      <div className="var-chips">{p.vars.map((v) => <button type="button" key={v} onClick={() => insert(v)}>{`{${v}}`}</button>)}</div>
      <div className="notif-preview"><img src="/icons/icon-192.png" alt="" width={30} height={30}/><span><small>mellow · sekarang</small><strong>{preview.title}</strong><span>{preview.body}</span></span></div>
      <div className="pref-actions">
        <button className="primary-button" type="submit"><Check size={14}/> Simpan</button>
        <button className="secondary-button" type="button" onClick={async () => { try { const r = await api<{ sent: number }>("/api/notification-prefs/test", { method: "POST", body: { key: p.key, title: title || null, body: body || null, beforeMin } }); toast(r.sent ? "Contoh dikirim ke HP-mu" : "Contoh masuk ke daftar notifikasi", r.sent ? undefined : "Aktifkan notifikasi di Pengaturan agar muncul di HP.") } catch (e) { toast("Gagal", (e as Error).message) } }}><Send size={14}/> Uji</button>
        {custom && <button className="secondary-button" type="button" onClick={() => onSave(p, { title: null, body: null }, "Kembali ke pesan bawaan")}><RotateCcw size={14}/> Bawaan</button>}
      </div>
    </form>}
  </div>
}

/** Kartu kecil di Ringkasan: sholat berikutnya. */
export function NextPrayerMini({ onOpen }: { onOpen: () => void }) {
  const [t, setT] = useState<{ city: string; today: Times | null; tomorrow: Times | null; hijri: string } | null>(null)
  const [now, setNow] = useState(nowMinutes())
  useEffect(() => { api<IbadahData>("/api/ibadah").then((d) => setT({ city: d.city.name, today: d.times.today, tomorrow: d.times.tomorrow, hijri: d.hijriToday.label })).catch(() => {}) }, [])
  useEffect(() => { const i = setInterval(() => setNow(nowMinutes()), 30_000); return () => clearInterval(i) }, [])
  if (!t?.today) return null
  const list = (["subuh", "dzuhur", "ashar", "maghrib", "isya"] as const).map((k) => ({ k, time: t.today![k] }))
  const nx = list.find((x) => toMin(x.time) > now) ?? (t.tomorrow ? { k: "subuh" as const, time: t.tomorrow.subuh, tmr: true } : null)
  if (!nx) return null
  const mins = "tmr" in nx ? 24 * 60 - now + toMin(nx.time) : toMin(nx.time) - now
  return <button className="reminder-banner glass-panel prayer-mini" onClick={onOpen}><span className="reminder-icon"><Sparkles size={18}/></span><span><strong>{nx.k.charAt(0).toUpperCase() + nx.k.slice(1)} · {nx.time}</strong><small>{sisaLabel(mins)} · {cityLabel(t.city)} · {t.hijri}</small></span><ChevronRight size={16}/></button>
}
