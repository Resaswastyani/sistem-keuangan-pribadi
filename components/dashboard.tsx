"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BellOff, CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, Goal, KeyRound, LayoutDashboard, ListChecks, LogOut, Menu, Moon, MoonStar, MoreHorizontal, Palette, Pencil, Percent, PiggyBank, Plus, RefreshCw, Repeat, Send, Settings2, Smartphone, Sparkles, Sun, Target, Trash2, TrendingDown, TrendingUp, Trophy, Wallet, X } from "lucide-react"
import { api, type DashboardData } from "@/lib/client-api"
import { CARD_THEMES, MENU_KEYS } from "@/lib/card-themes"
import { IbadahPage, NextPrayerMini, NotificationPrefs } from "@/components/ibadah"
import { IconPicker, iconFor } from "@/components/icons"
import { RoutinesPanel, WEEKDAYS, type Routine } from "@/components/routines"
import { RoutineNotifs } from "@/components/routine-notifs"
import { ThemePicker } from "@/components/theme-picker"
import { currentSubscription, disablePush, enablePush, pushEnv, registerServiceWorker, type PushEnv } from "@/lib/push-client"

type Tab = (typeof MENU_KEYS)[number]
type Tx = DashboardData["transactions"][number]
type GoalT = DashboardData["goals"][number]
type Sched = DashboardData["schedule"][number]
type Rem = DashboardData["reminders"][number]
type Dialog =
  | null
  | { type: "transaction"; item?: Tx }
  | { type: "saving"; goalId?: string }
  | { type: "goal"; item?: GoalT }
  | { type: "schedule"; item?: Sched }
  | { type: "reminder"; item?: Rem }
  | { type: "routine"; item: Routine }
  | { type: "password" }
  | { type: "theme" }
type Toast = { id: number; title: string; body?: string }

const EXPENSE_CATEGORIES = ["Makan & minum", "Transportasi", "Pendidikan", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya"]
const INCOME_CATEGORIES = ["Pemasukan", "Uang saku", "Gaji", "Hadiah", "Bonus"]
const REPEAT_LABEL = { none: "Sekali", daily: "Setiap hari", weekly: "Setiap minggu", monthly: "Setiap bulan" } as const
const NAV: { label: Tab; icon: LucideIcon }[] = [
  { label: "Ringkasan", icon: LayoutDashboard }, { label: "Keuangan", icon: Wallet }, { label: "Ibadah", icon: MoonStar }, { label: "Jadwal", icon: CalendarDays },
  { label: "Target", icon: Goal }, { label: "Pengingat", icon: Bell }, { label: "Pengaturan", icon: Settings2 },
]
const TABS = NAV.map((n) => n.label)

const money = (value: number) => `Rp ${Math.abs(Math.round(value)).toLocaleString("id-ID")}`
const shortMoney = (v: number) => (v >= 1_000_000 ? `Rp ${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt` : v >= 1000 ? `Rp ${Math.round(v / 1000)}k` : `Rp ${v}`)
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)
/** Persentase progres target: uang = terkumpul/target, pencapaian = persen manual / checklist / tercapai. */
const goalPercent = (g: GoalT) => (g.kind === "money" ? pct(g.savedAmount, g.targetAmount ?? 0) : g.achievedAt ? 100 : g.progress)
const newId = () => Math.random().toString(36).slice(2, 10)

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function dayLabel(day: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))
}
function localParts(iso: string, tz: string) {
  const d = new Date(iso)
  return { day: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d), time: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d) }
}
function whenLabel(iso: string, tz: string, today: string) {
  const { day, time } = localParts(iso, tz)
  const t = time.replace(":", ".")
  if (day === today) return { day: "Hari ini", time: t }
  if (day === addDays(today, -1)) return { day: "Kemarin", time: t }
  if (day === addDays(today, 1)) return { day: "Besok", time: t }
  return { day: dayLabel(day, { day: "numeric", month: "short" }), time: t }
}
function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "baru saja"
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  return `${Math.floor(s / 86400)} hari lalu`
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadError, setLoadError] = useState("")
  const [day, setDay] = useState<string | null>(null)
  const [active, setActive] = useState<Tab>("Ringkasan")
  const [light, setLight] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [push, setPush] = useState<{ env: PushEnv; subscribed: boolean }>({ env: { supported: false, ios: false, standalone: false, permission: "unsupported", needsInstall: false }, subscribed: false })
  const [busy, setBusy] = useState(false)
  const [routineVersion, setRoutineVersion] = useState(0)
  const [remTab, setRemTab] = useState<"semua" | "ibadah" | "jadwal" | "buatan" | "lainnya">("semua")
  const dayRef = useRef<string | null>(null)
  dayRef.current = day

  const toast = useCallback((title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, title, body }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000)
  }, [])

  const load = useCallback(async () => {
    try {
      const qs = dayRef.current ? `?day=${dayRef.current}` : ""
      const next = await api<DashboardData>(`/api/dashboard${qs}`)
      setData(next)
      setLoadError("")
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  // Muat awal + baca ?tab= / ?action= (dari shortcut PWA atau klik notifikasi)
  useEffect(() => {
    try { setLight(localStorage.getItem("mellow-theme") === "light") } catch {}
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab") as Tab | null
    if (tab && TABS.includes(tab)) setActive(tab)
    if (params.get("action") === "transaction") setDialog({ type: "transaction" })
    if (params.size) window.history.replaceState(null, "", "/")
    load()
  }, [load])

  useEffect(() => { if (day) load() }, [day, load])

  // Sinkron otomatis: tiap 60 detik, saat app kembali dibuka, dan saat push masuk.
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && load()
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 60_000)
    document.addEventListener("visibilitychange", onVisible)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "mellow:push") {
        toast(event.data.payload?.title ?? "Notifikasi baru", event.data.payload?.body)
        load()
      }
    }
    navigator.serviceWorker?.addEventListener("message", onMessage)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); navigator.serviceWorker?.removeEventListener("message", onMessage) }
  }, [load, toast])

  // Status push perangkat ini
  const refreshPush = useCallback(async () => {
    const env = pushEnv()
    const sub = env.supported ? await currentSubscription().catch(() => null) : null
    setPush({ env, subscribed: Boolean(sub) && env.permission === "granted" })
  }, [])
  useEffect(() => { registerServiceWorker().then(refreshPush) }, [refreshPush])

  const setTheme = (isLight: boolean) => { setLight(isLight); try { localStorage.setItem("mellow-theme", isLight ? "light" : "dark") } catch {} }
  const selectPage = (label: Tab) => { setActive(label); setMenuOpen(false); setNotice(false); window.scrollTo({ top: 0 }) }

  const mutate = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    try {
      await fn()
      if (success) toast(success)
      await load()
      return true
    } catch (e) {
      toast("Gagal", (e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const setMenuTheme = async (menu: Tab, theme: string) => {
    setData((d) => (d ? { ...d, cardThemes: { ...d.cardThemes, [menu]: theme } } : d))
    try { await api("/api/settings", { method: "PATCH", body: { cardThemes: { [menu]: theme } } }) } catch (e) { toast("Gagal menyimpan tema", (e as Error).message); load() }
  }

  const openNotices = async () => {
    const open = !notice
    setNotice(open)
    if (open && data && data.unreadCount > 0) {
      await api("/api/notifications", { method: "PATCH", body: { all: true } }).catch(() => {})
      setData((d) => (d ? { ...d, unreadCount: 0 } : d))
      if ("clearAppBadge" in navigator) (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {})
    }
  }

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {})
    window.location.href = "/login"
  }

  const togglePush = async () => {
    setBusy(true)
    try {
      if (push.subscribed) { await disablePush(); toast("Notifikasi dimatikan di perangkat ini") }
      else { await enablePush(); toast("Notifikasi aktif ✳", "Coba tekan “Kirim notifikasi uji”.") }
    } catch (e) {
      toast("Belum bisa mengaktifkan", (e as Error).message)
    } finally {
      setBusy(false)
      refreshPush()
    }
  }

  if (!data) {
    return <main className="app-shell boot-screen" data-theme={light ? "light" : "dark"}>
      <div className="boot-card glass-panel">
        <span className="brand-mark"><Sparkles size={19}/></span>
        {loadError ? <><strong>Tidak bisa memuat data</strong><small>{loadError}</small><button className="primary-button" onClick={load}><RefreshCw size={15}/> Coba lagi</button></> : <><strong>Menyiapkan ruangmu…</strong><small>Sebentar ya</small></>}
      </div>
    </main>
  }

  const { stats, user, today, timezone } = data
  const selectedDay = data.day
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(selectedDay, i - 3))
  const dateLabel = dayLabel(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()
  const totalDone = data.schedule.filter((i) => i.done).length
  const activeReminders = data.reminders.filter((r) => !r.done)
  const moneyGoals = data.goals.filter((g) => g.kind === "money")
  const topMoneyGoal = [...moneyGoals].sort((a, b) => goalPercent(b) - goalPercent(a))[0]
  const featuredGoal = [...data.goals].filter((g) => goalPercent(g) < 100).sort((a, b) => goalPercent(b) - goalPercent(a))[0] ?? data.goals[0]
  const budgetLeft = Math.max(0, stats.monthlyBudget - stats.monthExpense)
  const budgetPct = pct(stats.monthExpense, stats.monthlyBudget)
  const initial = user.displayName.charAt(0).toUpperCase()
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date()))
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam"
  const pageTheme = data.cardThemes[active] ?? "none"

  const patchGoal = (id: string, body: Record<string, unknown>, msg?: string) => {
    // Update optimistis: checklist/persen langsung berubah di layar, server menyusul.
    setData((d) => d ? { ...d, goals: d.goals.map((g) => {
      if (g.id !== id) return g
      const next = { ...g, ...(body.milestones ? { milestones: body.milestones as GoalT["milestones"] } : {}), ...(typeof body.progress === "number" ? { progress: body.progress } : {}) }
      if (body.milestones && next.milestones.length) next.progress = Math.round((next.milestones.filter((m) => m.done).length / next.milestones.length) * 100)
      if (body.achieved !== undefined) next.achievedAt = body.achieved ? new Date().toISOString() : null
      return next
    }) } : d)
    return mutate(() => api(`/api/goals/${id}`, { method: "PATCH", body }), msg)
  }
  const toggleSchedule = (id: string, done: boolean) => mutate(() => api(`/api/schedule/${id}`, { method: "PATCH", body: { done } }))
  const scheduleProps = {
    items: data.schedule,
    onToggle: toggleSchedule,
    onEdit: (item: Sched) => setDialog({ type: "schedule", item }),
    onDelete: (id: string) => { const item = data.schedule.find((i) => i.id === id); return mutate(() => api(`/api/schedule/${id}`, { method: "DELETE" }), item?.routineId ? "Rutinitas dilewati untuk hari ini" : "Kegiatan dihapus") },
  }
  const deleteTx = (t: Tx) => confirm(`Hapus transaksi “${t.name}”?`) && mutate(() => api(`/api/transactions/${t.id}`, { method: "DELETE" }), "Transaksi dihapus")

  return <main className="app-shell" data-theme={light ? "light" : "dark"}>
    <aside className={`sidebar glass-panel ${menuOpen ? "sidebar-open" : ""}`}>
      <a href="/" className="brand"><span className="brand-mark"><Sparkles size={19}/></span><span>mellow<span className="brand-dot">.</span><small>YOUR LIFE, IN FLOW</small></span></a>
      <div className="side-label">MENU UTAMA</div>
      <nav className="nav-list" aria-label="Menu utama">{NAV.slice(0, 5).map(({ label, icon: Icon }) => <button key={label} onClick={() => selectPage(label)} className={`nav-item ${active === label ? "selected" : ""}`}><Icon size={18}/>{label}{label === "Jadwal" && data.schedule.length > 0 && <span className="nav-count">{data.schedule.length}</span>}</button>)}</nav>
      <div className="side-label space-top">PERSONAL</div>
      <nav className="nav-list" aria-label="Menu personal">{NAV.slice(5).map(({ label, icon: Icon }) => <button key={label} onClick={() => selectPage(label)} className={`nav-item ${active === label ? "selected" : ""}`}><Icon size={18}/>{label}{label === "Pengingat" && activeReminders.length > 0 && <span className="nav-count">{activeReminders.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-icon"><Sparkles size={17}/></span><strong>Ruang untuk bertumbuh</strong><p>Langkah kecilmu berarti banyak.</p><button onClick={() => selectPage("Target")}>Lihat target <ArrowUpRight size={14}/></button></div><div className="profile"><span className="avatar">{initial}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small></span><button onClick={logout} className="logout-icon" aria-label="Keluar" title="Keluar"><LogOut size={16}/></button></div></div>
    </aside>
    {menuOpen && <button className="menu-scrim" aria-label="Tutup menu" onClick={() => setMenuOpen(false)}/>}

    <section className="main-content">
      <header className="topbar"><div className="topbar-start"><button className="icon-button burger-button" aria-label={menuOpen ? "Tutup menu" : "Buka menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={18}/> : <Menu size={18}/>}</button><div className="breadcrumb">Personal space <span>/</span> <strong>{active}</strong></div></div>
        <div className="top-actions">
          <button className="icon-button" aria-label={`Tema animasi kartu menu ${active}`} title="Tema animasi kartu" onClick={() => setDialog({ type: "theme" })}><Palette size={17}/></button>
          <button className="icon-button search-button" aria-label="Muat ulang" onClick={load}><RefreshCw size={17}/></button>
          <button className="icon-button theme-button" aria-label={light ? "Aktifkan mode gelap" : "Aktifkan mode terang"} onClick={() => setTheme(!light)}>{light ? <Moon size={17}/> : <Sun size={17}/>}</button>
          <button className="icon-button notification-button" aria-label={`Notifikasi${data.unreadCount ? `, ${data.unreadCount} belum dibaca` : ""}`} onClick={openNotices}><Bell size={18}/>{data.unreadCount > 0 && <i/>}</button>
          <span className="avatar top-avatar">{initial}</span>
          <button className="logout-button" onClick={logout}><LogOut size={15}/> Keluar</button>
          {notice && <div className="notice-pop glass-panel">
            <div className="notice-head"><strong>Notifikasi</strong><button onClick={() => { setNotice(false); selectPage("Pengingat") }}>Pengingat <ArrowUpRight size={12}/></button></div>
            {data.notifications.length === 0 ? <span className="notice-empty">Belum ada notifikasi. Pengingatmu akan muncul di sini.</span> :
              <div className="notice-list">{data.notifications.slice(0, 12).map((n) => <a key={n.id} href={n.url} onClick={(e) => { e.preventDefault(); const t = new URL(n.url, location.origin).searchParams.get("tab") as Tab | null; if (t && TABS.includes(t)) selectPage(t); setNotice(false) }} className={`notice-item ${n.readAt ? "" : "unread"}`}><b>{n.title}</b>{n.body && <span>{n.body}</span>}<small>{timeAgo(n.createdAt)}</small></a>)}</div>}
          </div>}
        </div>
      </header>

      <div className="page-wrap" data-card-theme={pageTheme}>
        {active === "Ringkasan" && <>
          <div className="greeting-row"><div><div className="eyebrow"><span className="live-dot"/>{dateLabel}</div><h1>{greeting}, <em>{user.displayName}.</em></h1><p className="page-subtitle">Hari yang baik dimulai dari langkah kecil. Kamu sudah melakukannya.</p></div><button className="primary-button" onClick={() => setDialog({ type: "transaction" })}><Plus size={17}/> Catat aktivitas</button></div>
          <NextPrayerMini onOpen={() => selectPage("Ibadah")}/>
          <section className="stats-grid" aria-label="Ringkasan keuangan">
            <article className="stat-card glass-panel"><div className="stat-top"><span>Total saldo</span><span className="stat-icon mint-bg"><Wallet size={18}/></span></div><strong className="stat-value">{stats.balance < 0 ? "− " : ""}{money(stats.balance)}</strong><div className="stat-foot">{stats.balanceChangePct !== null ? <span className={stats.balanceChangePct >= 0 ? "positive" : "soft-text"}>{stats.balanceChangePct >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>} {Math.abs(stats.balanceChangePct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span> : <span className="soft-text">Mulai mencatat</span>}<span>dari awal bulan</span></div></article>
            <article className="stat-card glass-panel"><div className="stat-top"><span>Pemasukan bulan ini</span><span className="stat-icon violet-bg"><ArrowDownLeft size={18}/></span></div><strong className="stat-value">{money(stats.monthIncome)}</strong><div className="stat-foot"><span className="positive"><ArrowDownLeft size={13}/> {stats.monthIncomeCount} transaksi</span><span> bulan ini</span></div></article>
            <article className="stat-card glass-panel"><div className="stat-top"><span>Pengeluaran bulan ini</span><span className="stat-icon pink-bg"><ArrowUpRight size={18}/></span></div><strong className="stat-value">{money(stats.monthExpense)}</strong><div className="stat-foot"><span className="soft-text">{budgetPct >= 100 ? "Melebihi" : budgetPct >= 80 ? "Hampir habis" : "Masih aman"}</span><span> · {budgetPct}% anggaran</span></div></article>
            <article className="stat-card glass-panel"><div className="stat-top"><span>Target tabungan</span><span className="stat-icon amber-bg"><Target size={18}/></span></div><strong className="stat-value">{topMoneyGoal ? goalPercent(topMoneyGoal) : 0}<span className="percent">%</span></strong><div className="progress-track"><span style={{ width: `${topMoneyGoal ? goalPercent(topMoneyGoal) : 0}%` }}/></div><div className="stat-foot"><span className="soft-text">{topMoneyGoal?.title ?? "Belum ada target uang"}</span>{topMoneyGoal && <span> · {shortMoney(Math.max(0, (topMoneyGoal.targetAmount ?? 0) - topMoneyGoal.savedAmount))} lagi</span>}</div></article>
          </section>
          <section className="content-grid"><FinanceChart chart={data.chart} onDetail={() => selectPage("Keuangan")}/><TargetCard goal={featuredGoal} onAction={() => !featuredGoal ? setDialog({ type: "goal" }) : featuredGoal.kind === "money" ? setDialog({ type: "saving", goalId: featuredGoal.id }) : selectPage("Target")}/></section>
          <section className="lower-grid">
            <article className="panel glass-panel schedule-panel"><div className="panel-heading schedule-header"><div><div className="eyebrow">RITME HARI INI</div><h2>Agenda harian <span className="tiny-count">{data.schedule.length}</span></h2></div><button className="text-link" onClick={() => selectPage("Jadwal")}>Lihat semua <ArrowUpRight size={14}/></button></div><WeekStrip days={weekdays} selected={selectedDay} today={today} onSelect={setDay}/><ScheduleTimeline {...scheduleProps} items={data.schedule.slice(0, 4)} onAdd={() => setDialog({ type: "schedule" })}/></article>
            <TransactionsCard transactions={data.transactions.slice(0, 4)} tz={timezone} today={today} onSeeAll={() => selectPage("Keuangan")}/>
          </section>
          <footer className="footer-note"><span>sudah {totalDone} langkah kecil selesai hari ini</span><span className="footer-flower">✳</span><span>Satu hari, satu langkah kecil.</span></footer>
        </>}

        {active === "Keuangan" && <>
          <PageHeading eyebrow="UANGMU, DENGAN SADAR" title="Keuangan" description="Lihat ke mana uangmu pergi dan rayakan setiap kemajuan kecil." action={<button className="primary-button" onClick={() => setDialog({ type: "transaction" })}><Plus size={17}/> Catat transaksi</button>}/>
          <section className="stats-grid"><Stat title="Total saldo" value={`${stats.balance < 0 ? "− " : ""}${money(stats.balance)}`} icon={<Wallet size={18}/>} color="mint-bg"/><Stat title="Pemasukan bulan ini" value={money(stats.monthIncome)} icon={<ArrowDownLeft size={18}/>} color="violet-bg"/><Stat title="Pengeluaran bulan ini" value={money(stats.monthExpense)} icon={<ArrowUpRight size={18}/>} color="pink-bg"/><Stat title="Anggaran tersisa" value={money(budgetLeft)} icon={<Target size={18}/>} color="amber-bg" foot={`dari ${money(stats.monthlyBudget)}`}/></section>
          <section className="content-grid finance-detail"><FinanceChart chart={data.chart}/>
            <article className="panel glass-panel budget-panel"><div className="eyebrow">ANGGARAN BULANAN · {budgetPct}%</div><h2>Pengeluaran per kategori</h2>
              {data.categories.length === 0 ? <p className="empty-state">Belum ada pengeluaran bulan ini.</p> : data.categories.map((item) => <div className="budget-row" key={item.category}><div><span>{item.category}</span><small>{money(item.total)}</small></div><div className="progress-track"><span style={{ width: `${pct(item.total, Math.max(stats.monthlyBudget, stats.monthExpense))}%` }}/></div></div>)}
              <button className="text-link budget-edit" onClick={() => selectPage("Pengaturan")}>Ubah anggaran <ArrowUpRight size={13}/></button>
            </article>
          </section>
          <TransactionsCard transactions={data.transactions} tz={timezone} today={today} expanded onEdit={(item) => setDialog({ type: "transaction", item })} onDelete={deleteTx}/>
        </>}

        {active === "Ibadah" && <IbadahPage toast={toast}/>}

        {active === "Jadwal" && <>
          <PageHeading eyebrow="RITME YANG PAS UNTUKMU" title="Jadwal harian" description="Beri ruang untuk fokus, istirahat, dan hal-hal yang kamu suka." action={<button className="primary-button" onClick={() => setDialog({ type: "schedule" })}><Plus size={17}/> Tambah kegiatan</button>}/>
          <section className="panel glass-panel schedule-full"><div className="calendar-top"><div><div className="eyebrow">{selectedDay === today ? "HARI INI" : dayLabel(selectedDay, { weekday: "long" }).toUpperCase()}</div><h2>{dayLabel(selectedDay, { day: "numeric", month: "long", year: "numeric" })}</h2></div><div className="day-nav"><button className="period-select" aria-label="Minggu sebelumnya" onClick={() => setDay(addDays(selectedDay, -7))}><ChevronLeft size={14}/></button><button className="period-select" onClick={() => setDay(today)}>Hari ini</button><button className="period-select" aria-label="Minggu berikutnya" onClick={() => setDay(addDays(selectedDay, 7))}><ChevronRight size={14}/></button></div></div><WeekStrip days={weekdays} selected={selectedDay} today={today} onSelect={setDay}/><ScheduleTimeline {...scheduleProps} onAdd={() => setDialog({ type: "schedule" })}/></section>
          <RoutinesPanel toast={toast} onChanged={load} version={routineVersion} onEdit={(item) => setDialog({ type: "routine", item })}/>
          <div className="reminder-banner glass-panel"><span className="reminder-icon"><Bell size={18}/></span><span><strong>{push.subscribed ? "Notifikasi aktif di perangkat ini" : "Aktifkan notifikasi"}</strong><small>{push.subscribed ? "Kegiatan dengan pengingat akan muncul di layar HP-mu." : "Supaya agenda & pengingat muncul seperti pesan di HP."}</small></span>{!push.subscribed && <button className="text-link" onClick={() => selectPage("Pengaturan")}>Atur <ArrowUpRight size={13}/></button>}</div>
        </>}

        {active === "Target" && <>
          <PageHeading eyebrow="MIMPI BESAR, LANGKAH KECIL" title="Target impian" description="Tabungan untuk barang impian, atau pencapaian seperti beasiswa, lulus tes, dan kebiasaan baru." action={<button className="primary-button" onClick={() => setDialog({ type: "goal" })}><Plus size={17}/> Target baru</button>}/>
          {data.goals.length === 0 ? <div className="goal-note glass-panel"><Sparkles size={18}/><span><strong>Belum ada target.</strong><small>Buat target pertamamu, misalnya dana darurat atau beasiswa LPDP.</small></span></div> :
            <section className="goal-grid">{data.goals.map((goal) => <GoalCard key={goal.id} goal={goal}
              onSave={() => setDialog({ type: "saving", goalId: goal.id })}
              onEdit={() => setDialog({ type: "goal", item: goal })}
              onDelete={() => confirm(`Hapus target “${goal.title}”?${goal.kind === "money" ? " Riwayat setoran tetap tersimpan." : ""}`) && mutate(() => api(`/api/goals/${goal.id}`, { method: "DELETE" }), "Target dihapus")}
              onPatch={(body, msg) => patchGoal(goal.id, body, msg)}/>)}</section>}
          <div className="goal-note glass-panel"><Sparkles size={18}/><span><strong>Kamu sudah melakukan hal hebat.</strong><small>Mimpi besar dicapai lewat langkah kecil yang konsisten.</small></span></div>
        </>}

        {active === "Pengingat" && <>
          <PageHeading eyebrow="WAKTUNYA NANTI, BUKAN TERLUPA" title="Pengingat" description="Semua notifikasi di satu tempat: sholat, puasa, jadwal, dan pengingat buatanmu. Ubah isi pesannya dan nyalakan atau matikan sesukamu." action={<button className="primary-button" onClick={() => setDialog({ type: "reminder" })}><Plus size={17}/> Buat pengingat</button>}/>
          {!push.subscribed && <PushCard push={push} busy={busy} onToggle={togglePush}/>}
          <div className="rem-tabs" role="tablist">{([["semua", "Semua"], ["ibadah", "Sholat & puasa"], ["jadwal", "Jadwal rutin"], ["buatan", "Buatanku"], ["lainnya", "Lainnya"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={remTab === k} className={remTab === k ? "active" : ""} onClick={() => setRemTab(k)}>{l}</button>)}</div>
          {(remTab === "semua" || remTab === "ibadah") && <NotificationPrefs groups={["sholat", "puasa"]} toast={toast} title="Sholat & puasa"/>}
          {(remTab === "semua" || remTab === "jadwal") && <RoutineNotifs toast={toast}/>}
          {(remTab === "semua" || remTab === "buatan") && <>
            <div className="rem-section-head"><div><div className="eyebrow">PENGINGAT BUATANMU</div><h2>Pengingat custom</h2></div><button className="text-link" onClick={() => setDialog({ type: "reminder" })}><Plus size={13}/> Tambah</button></div>
            <section className="reminder-list">
              {data.reminders.length === 0 && <article className="panel glass-panel empty-state">Belum ada pengingat. Tekan “Buat pengingat” untuk menambahkan.</article>}
              {data.reminders.map((item) => { const Icon = iconFor(item.icon, Bell); const w = whenLabel(item.remindAt, timezone, today)
                return <article className={`panel glass-panel reminder-row ${item.done ? "is-done" : ""}`} key={item.id}><span className={`timeline-icon ${item.color}`}><Icon size={18}/></span><span className="reminder-copy"><strong>{item.title}</strong><small>{item.detail || REPEAT_LABEL[item.repeat]}{item.detail && item.repeat !== "none" ? ` · ${REPEAT_LABEL[item.repeat]}` : ""}</small></span><span className="reminder-when">{w.day}</span><strong className="reminder-at">{w.time}</strong>
                  <span className="row-actions"><button className="mini-edit" aria-label={`Ubah ${item.title}`} onClick={() => setDialog({ type: "reminder", item })}><Pencil size={14}/></button><button className="mini-delete" aria-label={`Hapus ${item.title}`} onClick={() => confirm(`Hapus pengingat “${item.title}”?`) && mutate(() => api(`/api/reminders/${item.id}`, { method: "DELETE" }), "Pengingat dihapus")}><Trash2 size={14}/></button></span>
                  <button className={`check-button ${item.done ? "completed" : ""}`} aria-label={item.done ? `Aktifkan lagi ${item.title}` : `Tandai ${item.title} selesai`} onClick={() => mutate(() => api(`/api/reminders/${item.id}`, { method: "PATCH", body: { done: !item.done } }))}>{item.done ? <Check size={14}/> : <span/>}</button></article> })}
            </section>
          </>}
          {(remTab === "semua" || remTab === "lainnya") && <NotificationPrefs groups={["lainnya"]} toast={toast} title="Ringkasan, anggaran & agenda"/>}
        </>}

        {active === "Pengaturan" && <>
          <PageHeading eyebrow="RUANG KECILMU" title="Pengaturan" description="Atur mellow supaya terasa seperti rumah sendiri."/>
          <section className="settings-grid">
            <article className="panel glass-panel settings-panel"><div className="eyebrow">NOTIFIKASI</div><h2>Pengingat di HP</h2><p>Muncul di layar kunci seperti pesan WhatsApp, di Android, iPhone, maupun laptop.</p>
              <div className="setting-row"><span><strong>Notifikasi di perangkat ini</strong><small>{push.subscribed ? "Aktif" : push.env.needsInstall ? "Tambahkan ke Layar Utama dulu" : push.env.permission === "denied" ? "Diblokir di pengaturan browser" : "Belum aktif"}</small></span><button className={push.subscribed ? "switch-on" : "switch-off"} role="switch" aria-checked={push.subscribed} aria-label="Notifikasi push" disabled={busy} onClick={togglePush}><i/></button></div>
              <PushCard push={push} busy={busy} onToggle={togglePush} compact/>
              <button className="secondary-button" disabled={busy} onClick={() => mutate(async () => { const r = await api<{ sent: number }>("/api/push/test", { method: "POST" }); if (!r.sent) throw new Error("Belum ada perangkat yang terdaftar. Aktifkan notifikasi dulu.") }, "Notifikasi uji dikirim")}><Send size={14}/> Kirim notifikasi uji</button>
            </article>
            <article className="panel glass-panel settings-panel"><div className="eyebrow">TAMPILAN & ANGGARAN</div><h2>Sesuaikan suasana</h2><div className="theme-options"><button className={`theme-option ${light ? "theme-chosen" : ""}`} onClick={() => setTheme(true)}><Sun size={19}/><strong>Mode terang</strong><small>Pink lembut & cerah</small></button><button className={`theme-option ${!light ? "theme-chosen" : ""}`} onClick={() => setTheme(false)}><Moon size={19}/><strong>Mode gelap</strong><small>Pink malam yang nyaman</small></button></div>
              <form className="transaction-form inline-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); mutate(() => api("/api/settings", { method: "PATCH", body: { monthlyBudget: Number(f.get("budget")), displayName: String(f.get("displayName")) } }), "Pengaturan disimpan") }}>
                <label htmlFor="displayName">Nama panggilan</label><input id="displayName" name="displayName" defaultValue={user.displayName} maxLength={40} required/>
                <label htmlFor="budget">Anggaran pengeluaran bulanan (Rupiah)</label><input id="budget" name="budget" type="number" min="0" step="1000" defaultValue={stats.monthlyBudget} required/>
                <button className="primary-button" type="submit" disabled={busy}>Simpan</button>
              </form>
            </article>
            <article className="panel glass-panel settings-panel"><div className="eyebrow"><Palette size={11}/> TEMA ANIMASI KARTU</div><h2>Suasana tiap menu</h2><p>Latar bergerak untuk semua kartu di menu tersebut. Bisa juga diganti cepat lewat ikon palet di atas.</p>
              <div className="menu-theme-list transaction-form">{MENU_KEYS.map((m) => <div key={m} className="menu-theme-row"><label htmlFor={`mt-${m}`}>{m}</label><select id={`mt-${m}`} value={data.cardThemes[m] ?? "none"} onChange={(e) => setMenuTheme(m, e.target.value)}>{CARD_THEMES.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}</select></div>)}</div>
            </article>
            <article className="panel glass-panel settings-panel"><div className="eyebrow">AKUN & KEAMANAN</div><h2>Profil kamu</h2><div className="profile-detail"><span className="avatar">{initial}</span><span><strong>{user.displayName}</strong><small>@{user.username}</small></span></div>
              <button className="secondary-button" onClick={() => setDialog({ type: "password" })}><KeyRound size={14}/> Ganti kata sandi</button>
              <button onClick={logout} className="logout-settings"><LogOut size={16}/> Keluar dari semua perangkat <ArrowRight size={15}/></button>
              <div className="settings-foot">Sesi terenkripsi · otomatis keluar setelah 7 hari</div>
            </article>
          </section>
          <NotificationPrefs groups={["lainnya"]} toast={toast} title="Pesan notifikasi lainnya"/>
        </>}
      </div>
    </section>

    <nav className="mobile-nav" aria-label="Navigasi mobile">{[NAV[0], NAV[1], NAV[2], NAV[3], NAV[5]].map(({ label, icon: Icon }) => <button key={label} onClick={() => selectPage(label)} className={active === label ? "mobile-selected" : ""}><Icon size={19}/><span>{label}</span></button>)}</nav>

    {dialog?.type === "theme" && <div className="dialog-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null) }}><section className="dialog-card glass-panel wide" role="dialog" aria-modal="true" aria-labelledby="theme-title">
      <button className="dialog-close" aria-label="Tutup" onClick={() => setDialog(null)}><X size={18}/></button>
      <div className="eyebrow"><Palette size={11}/> TEMA ANIMASI</div><h2 id="theme-title">Suasana menu {active}</h2><p>Dipakai untuk semua kartu di menu ini. Target bisa punya tema sendiri lewat tombol edit di kartunya.</p>
      <div style={{ marginTop: 16 }}><ThemePicker value={pageTheme} onChange={(v) => setMenuTheme(active, v ?? "none")}/></div>
    </section></div>}

    {dialog && dialog.type !== "theme" && <FormDialog dialog={dialog} data={data} busy={busy} onClose={() => setDialog(null)} onSubmit={async (fn, msg) => { if (await mutate(fn, msg)) { setDialog(null); setRoutineVersion((v) => v + 1) } }}/>}

    <div className="toast-stack" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast glass-panel"><img src="/icons/icon-192.png" alt="" width={34} height={34}/><span><strong>{t.title}</strong>{t.body && <small>{t.body}</small>}</span><button aria-label="Tutup" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X size={14}/></button></div>)}</div>
  </main>
}

function PushCard({ push, busy, onToggle, compact = false }: { push: { env: PushEnv; subscribed: boolean }; busy: boolean; onToggle: () => void; compact?: boolean }) {
  if (push.subscribed && compact) return null
  if (push.env.needsInstall) return <div className="install-hint glass-panel"><Smartphone size={18}/><span><strong>Pasang mellow di iPhone dulu</strong><small>Buka di Safari → tombol <b>Bagikan</b> (kotak dengan panah) → <b>Tambah ke Layar Utama</b>. Lalu buka mellow dari ikon di layar utama dan aktifkan notifikasi.</small></span></div>
  if (!push.env.supported) return <div className="install-hint glass-panel"><BellOff size={18}/><span><strong>Browser ini belum mendukung push</strong><small>Gunakan Chrome (Android/desktop) atau Safari di iOS 16.4+ yang sudah ditambahkan ke Layar Utama.</small></span></div>
  if (push.env.permission === "denied") return <div className="install-hint glass-panel"><BellOff size={18}/><span><strong>Notifikasi diblokir</strong><small>Izinkan notifikasi untuk situs ini lewat pengaturan browser / HP, lalu muat ulang.</small></span></div>
  if (compact) return <div className="install-hint glass-panel"><Smartphone size={18}/><span><strong>Tips Android</strong><small>Di Chrome, buka menu ⋮ → <b>Instal aplikasi</b> agar mellow punya ikon sendiri di layar utama.</small></span></div>
  return <div className="reminder-banner glass-panel"><span className="reminder-icon"><Bell size={18}/></span><span><strong>Nyalakan notifikasi</strong><small>Pengingat akan muncul di layar HP walau aplikasi sedang ditutup.</small></span><button className="primary-button" disabled={busy} onClick={onToggle}>Aktifkan</button></div>
}

function FormDialog({ dialog, data, busy, onClose, onSubmit }: { dialog: Exclude<NonNullable<Dialog>, { type: "theme" }>; data: DashboardData; busy: boolean; onClose: () => void; onSubmit: (fn: () => Promise<unknown>, msg: string) => void }) {
  const tx = dialog.type === "transaction" ? dialog.item : undefined
  const goalItem = dialog.type === "goal" ? dialog.item : undefined
  const sched = dialog.type === "schedule" ? dialog.item : undefined
  const rem = dialog.type === "reminder" ? dialog.item : undefined
  const routine = dialog.type === "routine" ? dialog.item : undefined
  const editing = Boolean(tx || goalItem || sched || rem || routine)

  const [kind, setKind] = useState<"expense" | "income">(tx && tx.amount > 0 ? "income" : "expense")
  const [goalKind, setGoalKind] = useState<"money" | "achievement">(goalItem?.kind ?? "money")
  const [progressMode, setProgressMode] = useState<"percent" | "checklist">(goalItem?.progressMode ?? "checklist")
  const [milestones, setMilestones] = useState<{ id: string; text: string; done: boolean }[]>(goalItem?.milestones?.length ? goalItem.milestones : [{ id: newId(), text: "", done: false }])
  const [progress, setProgress] = useState(goalItem?.progress ?? 0)
  const [error, setError] = useState("")
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Date.now() + 15 * 60_000))
  const goal = dialog.type === "saving" ? data.goals.find((g) => g.id === dialog.goalId) ?? data.goals.find((g) => g.kind === "money") : undefined
  const moneyGoals = data.goals.filter((g) => g.kind === "money")
  const txLocal = tx ? localParts(tx.occurredAt, data.timezone) : null
  const isSavingTx = Boolean(tx?.goalId)

  const titles: Record<typeof dialog.type, [string, string]> = {
    transaction: [tx ? "Ubah transaksi" : "Catat transaksi", isSavingTx ? "Setoran tabungan: mengubah jumlah ikut menyesuaikan saldo target." : "Masukkan transaksi untuk memperbarui ringkasanmu."],
    saving: ["Tambah tabungan", goal ? `Sisihkan sedikit demi sedikit untuk ${goal.title}.` : "Buat target uang dulu ya."],
    goal: [goalItem ? "Ubah target" : "Target baru", "Bisa berupa tabungan uang, atau pencapaian seperti beasiswa dan lulus tes."],
    schedule: [sched ? "Ubah kegiatan" : "Tambah kegiatan", sched?.routineId ? "Perubahan hanya untuk hari ini. Ubah semua minggu lewat Rutinitas mingguan." : `Untuk ${dayLabel(sched?.day ?? data.day, { weekday: "long", day: "numeric", month: "long" })}.`],
    reminder: [rem ? "Ubah pengingat" : "Buat pengingat", "Akan dikirim sebagai notifikasi di HP-mu."],
    routine: ["Ubah rutinitas", `Setiap ${routine ? WEEKDAYS[routine.weekday] : ""}. Agenda minggu-minggu berikutnya ikut berubah.`],
    password: ["Ganti kata sandi", "Semua perangkat lain akan otomatis keluar."],
  }
  const [title, desc] = titles[dialog.type]

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const remindVal = f.remind === undefined ? undefined : f.remind === "" ? null : Number(f.remind)
    switch (dialog.type) {
      case "transaction": {
        const body = { name: f.name, amount: Number(f.amount), kind, category: f.category, date: f.date, time: f.time }
        return tx ? onSubmit(() => api(`/api/transactions/${tx.id}`, { method: "PATCH", body }), "Transaksi diperbarui") : onSubmit(() => api("/api/transactions", { body }), "Transaksi tersimpan")
      }
      case "saving": {
        const id = f.goalId || goal?.id
        if (!id) return setError("Belum ada target uang.")
        return onSubmit(() => api(`/api/goals/${id}/deposit`, { body: { amount: Number(f.amount) } }), "Tabungan bertambah ✳")
      }
      case "goal": {
        const cleanMilestones = milestones.map((m) => ({ ...m, text: m.text.trim() })).filter((m) => m.text)
        if (goalKind === "achievement" && progressMode === "checklist" && !cleanMilestones.length) return setError("Tambahkan minimal satu langkah di checklist.")
        const body = {
          kind: goalKind, title: f.title, note: f.note, deadline: f.deadline || null, color: f.color, icon: f.icon, theme: f.theme || null,
          ...(goalKind === "money" ? { targetAmount: Number(f.targetAmount) } : { targetAmount: null, progressMode, ...(progressMode === "checklist" ? { milestones: cleanMilestones } : { progress }) }),
        }
        return goalItem ? onSubmit(() => api(`/api/goals/${goalItem.id}`, { method: "PATCH", body }), "Target diperbarui") : onSubmit(() => api("/api/goals", { body }), "Target dibuat")
      }
      case "schedule": {
        if (f.endTime <= f.startTime) return setError("Jam selesai harus setelah jam mulai.")
        const body = { startTime: f.startTime, endTime: f.endTime, title: f.title, detail: f.detail, icon: f.icon, color: f.color, remindBeforeMin: remindVal }
        if (sched) return onSubmit(() => api(`/api/schedule/${sched.id}`, { method: "PATCH", body }), "Kegiatan diperbarui")
        if (repeatDays.length) return onSubmit(() => api("/api/routines", { body: { ...body, weekdays: repeatDays } }), `Rutinitas dibuat untuk ${repeatDays.length} hari/minggu`)
        return onSubmit(() => api("/api/schedule", { body: { ...body, day: data.day } }), "Kegiatan ditambahkan")
      }
      case "routine": {
        if (f.endTime <= f.startTime) return setError("Jam selesai harus setelah jam mulai.")
        return onSubmit(() => api(`/api/routines/${routine!.id}`, { method: "PATCH", body: { startTime: f.startTime, endTime: f.endTime, title: f.title, detail: f.detail, icon: f.icon, color: f.color, weekday: Number(f.weekday), remindBeforeMin: remindVal } }), "Rutinitas diperbarui")
      }
      case "reminder": {
        const body = { title: f.title, detail: f.detail, date: f.date, time: f.time, repeat: f.repeat, icon: f.icon, color: f.color }
        return rem ? onSubmit(() => api(`/api/reminders/${rem.id}`, { method: "PATCH", body }), "Pengingat diperbarui") : onSubmit(() => api("/api/reminders", { body }), "Pengingat dibuat")
      }
      case "password":
        if (f.newPassword !== f.confirm) return setError("Konfirmasi kata sandi tidak sama.")
        return onSubmit(() => api("/api/settings/password", { body: { currentPassword: f.currentPassword, newPassword: f.newPassword } }), "Kata sandi diganti")
    }
  }

  const iconField = (def: string) => <><label>Ikon</label><IconPicker name="icon" defaultValue={def}/></>
  const colorSelect = (def = "pink") => <><label htmlFor="f-color">Warna</label><select id="f-color" name="color" defaultValue={def}><option value="pink">Pink</option><option value="violet">Ungu</option><option value="mint">Mint</option><option value="amber">Kuning</option></select></>
  const remindSelect = (def: number | null) => <><label htmlFor="f-remind">Ingatkan aku</label><select id="f-remind" name="remind" defaultValue={def === null ? "" : String(def)}><option value="">Tanpa pengingat</option>{[0, 5, 10, 15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m === 0 ? "Saat mulai" : m < 60 ? `${m} menit sebelum` : `${m / 60} jam sebelum`}</option>)}</select></>
  const wide = dialog.type === "goal" || dialog.type === "schedule" || dialog.type === "reminder" || dialog.type === "routine"

  return <div className="dialog-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`dialog-card glass-panel ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <button className="dialog-close" aria-label="Tutup" onClick={onClose}><X size={18}/></button>
      <div className="eyebrow">{editing ? "UBAH DATA" : "SATU LANGKAH KECIL"}</div><h2 id="dialog-title">{title}</h2><p>{desc}</p>
      <form onSubmit={submit} className="transaction-form">
        {dialog.type === "transaction" && <>
          {!isSavingTx && <div className="kind-switch"><button type="button" className={kind === "expense" ? "kind-active" : ""} onClick={() => setKind("expense")}>Pengeluaran</button><button type="button" className={kind === "income" ? "kind-active" : ""} onClick={() => setKind("income")}>Pemasukan</button></div>}
          <label htmlFor="f-name">Nama transaksi</label><input id="f-name" name="name" autoFocus maxLength={80} defaultValue={tx?.name} placeholder={kind === "income" ? "Contoh: Uang saku" : "Contoh: Kopi susu"} required/>
          <label htmlFor="f-amount">Jumlah (Rupiah)</label><input id="f-amount" name="amount" type="number" inputMode="numeric" min="1" defaultValue={tx ? Math.abs(tx.amount) : undefined} placeholder="50000" required/>
          {!isSavingTx && <><label htmlFor="f-cat">Kategori</label><select id="f-cat" name="category" key={kind} defaultValue={tx?.category}>{(kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).concat(tx && ![...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].includes(tx.category) ? [tx.category] : []).map((c) => <option key={c}>{c}</option>)}</select></>}
          <div className="form-row"><span><label htmlFor="f-date">Tanggal</label><input id="f-date" name="date" type="date" defaultValue={txLocal?.day ?? data.today} max={data.today} required/></span><span><label htmlFor="f-time">Jam</label><input id="f-time" name="time" type="time" defaultValue={txLocal?.time ?? localParts(new Date().toISOString(), data.timezone).time} required/></span></div>
        </>}
        {dialog.type === "saving" && <>
          {moneyGoals.length > 1 && <><label htmlFor="f-goal">Target</label><select id="f-goal" name="goalId" defaultValue={goal?.id}>{moneyGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></>}
          <label htmlFor="f-amount">Jumlah tabungan (Rupiah)</label><input id="f-amount" name="amount" type="number" inputMode="numeric" min="1" autoFocus placeholder="50000" required/>
        </>}
        {dialog.type === "goal" && <>
          <label>Jenis target</label>
          <div className="goal-kind">
            <button type="button" className={goalKind === "money" ? "on" : ""} onClick={() => setGoalKind("money")}><strong><PiggyBank size={14}/> Tabungan uang</strong><small>Ada nominal, diisi lewat setoran tabungan.</small></button>
            <button type="button" className={goalKind === "achievement" ? "on" : ""} onClick={() => setGoalKind("achievement")}><strong><Trophy size={14}/> Pencapaian</strong><small>Mis. beasiswa LPDP, lulus psikotes, khatam Al-Qur’an.</small></button>
          </div>
          <label htmlFor="f-title">Nama target</label><input id="f-title" name="title" autoFocus maxLength={80} defaultValue={goalItem?.title} placeholder={goalKind === "money" ? "Contoh: Dana darurat" : "Contoh: Dapat beasiswa LPDP"} required/>
          <label htmlFor="f-note">Catatan</label><input id="f-note" name="note" maxLength={160} defaultValue={goalItem?.note} placeholder="Kenapa target ini penting?"/>
          {goalKind === "money" ? <div className="form-row"><span><label htmlFor="f-target">Jumlah target (Rupiah)</label><input id="f-target" name="targetAmount" type="number" inputMode="numeric" min="1" defaultValue={goalItem?.targetAmount ?? undefined} placeholder="5000000" required/></span><span><label htmlFor="f-deadline">Tenggat</label><input id="f-deadline" name="deadline" type="date" defaultValue={goalItem?.deadline ?? undefined}/></span></div> : <>
            <label htmlFor="f-deadline">Tenggat</label><input id="f-deadline" name="deadline" type="date" defaultValue={goalItem?.deadline ?? undefined}/>
            <label>Cara mengukur progres</label>
            <div className="kind-switch"><button type="button" className={progressMode === "checklist" ? "kind-active" : ""} onClick={() => setProgressMode("checklist")}><ListChecks size={13}/> Checklist langkah</button><button type="button" className={progressMode === "percent" ? "kind-active" : ""} onClick={() => setProgressMode("percent")}><Percent size={13}/> Persen manual</button></div>
            {progressMode === "checklist" ? <div className="milestone-edit">
              {milestones.map((m, i) => <div key={m.id} className="milestone-edit-row"><input value={m.text} maxLength={120} placeholder={["Contoh: Skor TOEFL ≥ 80", "Contoh: Siapkan esai", "Contoh: Lolos seleksi administrasi"][i % 3]} onChange={(e) => setMilestones((x) => x.map((y) => (y.id === m.id ? { ...y, text: e.target.value } : y)))}/><button type="button" className="mini-delete" aria-label="Hapus langkah" onClick={() => setMilestones((x) => (x.length > 1 ? x.filter((y) => y.id !== m.id) : x))}><Trash2 size={13}/></button></div>)}
              {milestones.length < 30 && <button type="button" className="text-link milestone-add" onClick={() => setMilestones((x) => [...x, { id: newId(), text: "", done: false }])}><Plus size={12}/> Tambah langkah</button>}
            </div> : <div className="goal-percent"><input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} aria-label="Progres"/><strong>{progress}%</strong></div>}
          </>}
          <label htmlFor="f-gcolor">Warna kartu</label><select id="f-gcolor" name="color" defaultValue={goalItem?.color ?? "goal-pink"}><option value="goal-pink">Pink</option><option value="goal-lilac">Lilac</option><option value="goal-peach">Peach</option></select>
          {iconField(goalItem?.icon ?? (goalKind === "money" ? "piggy" : "trophy"))}
          <label>Tema animasi kartu</label><ThemePicker name="theme" defaultValue={goalItem?.theme ?? null} allowInherit/>
        </>}
        {(dialog.type === "schedule" || dialog.type === "routine") && <>
          <label htmlFor="f-title">Nama kegiatan</label><input id="f-title" name="title" autoFocus maxLength={80} defaultValue={sched?.title ?? routine?.title} placeholder="Contoh: Belajar matematika" required/>
          <label htmlFor="f-detail">Detail</label><input id="f-detail" name="detail" maxLength={160} defaultValue={sched?.detail ?? routine?.detail} placeholder="Opsional"/>
          {routine && <><label htmlFor="f-weekday">Hari</label><select id="f-weekday" name="weekday" defaultValue={routine.weekday}>{[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select></>}
          <div className="form-row"><span><label htmlFor="f-start">Mulai</label><input id="f-start" name="startTime" type="time" defaultValue={sched?.startTime ?? routine?.startTime ?? "08:00"} required/></span><span><label htmlFor="f-end">Selesai</label><input id="f-end" name="endTime" type="time" defaultValue={sched?.endTime ?? routine?.endTime ?? "09:00"} required/></span></div>
          {remindSelect(sched ? sched.remindBeforeMin : routine ? routine.remindBeforeMin : 10)}
          {colorSelect(sched?.color ?? routine?.color)}
          {iconField(sched?.icon ?? routine?.icon ?? "sparkles")}
          {dialog.type === "schedule" && !sched && <>
            <label>Ulangi setiap minggu <small className="form-hint">(kosongkan = hanya tanggal ini)</small></label>
            <div className="weekday-pick">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button type="button" key={d} className={repeatDays.includes(d) ? "on" : ""} aria-pressed={repeatDays.includes(d)} onClick={() => setRepeatDays((x) => x.includes(d) ? x.filter((y) => y !== d) : [...x, d])}>{WEEKDAYS[d].slice(0, 3)}</button>)}</div>
          </>}
        </>}
        {dialog.type === "reminder" && <>
          <label htmlFor="f-title">Ingatkan aku untuk…</label><input id="f-title" name="title" autoFocus maxLength={80} defaultValue={rem?.title} placeholder="Contoh: Res, jangan lupa bayar kos ya" required/>
          <label htmlFor="f-detail">Detail</label><input id="f-detail" name="detail" maxLength={160} defaultValue={rem?.detail} placeholder="Opsional"/>
          <div className="form-row"><span><label htmlFor="f-date">Tanggal</label><input id="f-date" name="date" type="date" defaultValue={rem?.localDay ?? data.today} required/></span><span><label htmlFor="f-time">Jam</label><input id="f-time" name="time" type="time" defaultValue={rem?.localTime ?? now} required/></span></div>
          <label htmlFor="f-repeat">Ulangi</label><select id="f-repeat" name="repeat" defaultValue={rem?.repeat ?? "none"}><option value="none">Tidak diulang</option><option value="daily">Setiap hari</option><option value="weekly">Setiap minggu</option><option value="monthly">Setiap bulan</option></select>
          {colorSelect(rem?.color)}
          {iconField(rem?.icon ?? "bell")}
        </>}
        {dialog.type === "password" && <>
          <label htmlFor="f-cur">Kata sandi saat ini</label><input id="f-cur" name="currentPassword" type="password" autoComplete="current-password" required/>
          <label htmlFor="f-new">Kata sandi baru</label><input id="f-new" name="newPassword" type="password" autoComplete="new-password" minLength={10} required/>
          <label htmlFor="f-conf">Ulangi kata sandi baru</label><input id="f-conf" name="confirm" type="password" autoComplete="new-password" minLength={10} required/>
          <small className="form-hint">Minimal 10 karakter, kombinasi huruf dan angka.</small>
        </>}
        {error && <span className="form-error">{error}</span>}
        <button className="primary-button" type="submit" disabled={busy || (dialog.type === "saving" && moneyGoals.length === 0)}>{editing ? <Check size={16}/> : <Plus size={16}/>} {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan"}</button>
      </form>
    </section>
  </div>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="greeting-row page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{action}</div> }
function Stat({ title, value, icon, color, foot = "Ringkasan bulan ini" }: { title: string; value: string; icon: React.ReactNode; color: string; foot?: string }) { return <article className="stat-card glass-panel"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${color}`}>{icon}</span></div><strong className="stat-value">{value}</strong><div className="stat-foot"><span className="soft-text">{foot}</span></div></article> }

function WeekStrip({ days, selected, today, onSelect }: { days: string[]; selected: string; today: string; onSelect: (d: string) => void }) {
  return <div className="week-strip">{days.map((d) => <button key={d} onClick={() => onSelect(d)} className={`day-pill ${d === selected ? "day-active" : ""}`} aria-label={dayLabel(d, { weekday: "long", day: "numeric", month: "long" })} aria-pressed={d === selected}><span>{dayLabel(d, { weekday: "short" }).replace(".", "")}</span><strong>{Number(d.slice(8))}</strong>{d === today && <i/>}</button>)}</div>
}

/** Mengubah deret angka menjadi path SVG yang halus (Catmull-Rom → Bezier). */
function smoothPath(points: [number, number][]) {
  if (points.length < 2) return ""
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1].toFixed(1)}`
  }
  return d
}

function FinanceChart({ chart, onDetail }: { chart: DashboardData["chart"]; onDetail?: () => void }) {
  const { incomePath, expensePath, labels, max, totalIn, totalOut } = useMemo(() => {
    const max = Math.max(10000, ...chart.map((c) => Math.max(c.income, c.expense))) * 1.1
    const x = (i: number) => (chart.length > 1 ? (i / (chart.length - 1)) * 700 : 0)
    const y = (v: number) => 182 - (v / max) * 170
    return {
      incomePath: smoothPath(chart.map((c, i) => [x(i), y(c.income)])),
      expensePath: smoothPath(chart.map((c, i) => [x(i), y(c.expense)])),
      labels: chart.map((c) => dayLabel(c.day, { weekday: "short" }).replace(".", "")),
      max,
      totalIn: chart.reduce((s, c) => s + c.income, 0),
      totalOut: chart.reduce((s, c) => s + c.expense, 0),
    }
  }, [chart])
  const net = totalIn - totalOut
  return <article className="panel glass-panel finance-panel"><div className="panel-heading"><div><div className="eyebrow">GAMBARAN BESAR</div><h2>Arus keuangan</h2></div><span className="period-select">7 hari terakhir</span></div>
    <div className="chart-summary"><span>Masuk {money(totalIn)} · Keluar {money(totalOut)}</span><strong>{net < 0 ? "− " : "+ "}{money(net)}</strong><span className="chart-change">{net >= 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>} <small>selisih 7 hari terakhir</small></span></div>
    <div className="chart-area"><div className="y-labels">{[1, 0.75, 0.5, 0.25, 0].map((f) => <span key={f}>{shortMoney(Math.round((max * f) / 1000) * 1000)}</span>)}</div><div className="chart-inner"><div className="grid-lines"><i/><i/><i/><i/><i/></div>
      <svg className="chart-svg" viewBox="0 0 700 190" preserveAspectRatio="none" role="img" aria-label="Grafik pemasukan dan pengeluaran tujuh hari"><defs><linearGradient id="areaRose" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f3d77e" stopOpacity=".24"/><stop offset="1" stopColor="#f3d77e" stopOpacity="0"/></linearGradient><linearGradient id="areaLilac" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c9a8e8" stopOpacity=".17"/><stop offset="1" stopColor="#c9a8e8" stopOpacity="0"/></linearGradient></defs>
        <path d={`${incomePath} L700 190 L0 190 Z`} fill="url(#areaRose)"/><path d={`${expensePath} L700 190 L0 190 Z`} fill="url(#areaLilac)"/>
        <path d={incomePath} fill="none" stroke="#f3d77e" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/><path d={expensePath} fill="none" stroke="#c9a8e8" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/></svg>
      <div className="x-labels">{labels.map((l, i) => <span key={i}>{l}</span>)}</div></div></div>
    <div className="chart-legend"><span><i className="legend-mint"/> Pemasukan</span><span><i className="legend-violet"/> Pengeluaran</span>{onDetail && <button onClick={onDetail}>Detail keuangan <ArrowUpRight size={14}/></button>}</div></article>
}

function TargetCard({ goal, onAction }: { goal?: GoalT; onAction: () => void }) {
  const Icon = iconFor(goal?.icon)
  const percent = goal ? goalPercent(goal) : 0
  return <article className="panel glass-panel target-panel" data-card-theme={goal?.theme ?? undefined}><div className="panel-heading"><div><div className="eyebrow">{goal?.kind === "achievement" ? "PENCAPAIAN" : "SEDIKIT DEMI SEDIKIT"}</div><h2>Target impian</h2></div><span className="round-more" aria-hidden="true"><MoreHorizontal size={18}/></span></div><div className="target-art"><span className="target-glow"/><span className="target-emoji"><Icon size={42}/></span><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="sparkle-dot">✦</span></div>
    <h3>{goal?.title ?? "Buat target pertamamu"}</h3><p>{goal?.note || "Mulai dari yang kecil."}</p>
    {goal && <>{goal.kind === "money" ? <div className="target-numbers"><strong>{money(goal.savedAmount)}</strong><span>dari {money(goal.targetAmount ?? 0)}</span></div> : <div className="target-numbers"><strong>{percent}%</strong><span>{goal.progressMode === "checklist" ? `${goal.milestones.filter((m) => m.done).length}/${goal.milestones.length} langkah` : "progres"}</span></div>}
      <div className="progress-track target-progress"><span style={{ width: `${percent}%` }}/></div><div className="target-meta"><span>{percent}% {goal.kind === "money" ? "terkumpul" : "tercapai"}</span>{goal.deadline && <span>Target: {dayLabel(goal.deadline, { month: "short", year: "numeric" })}</span>}</div></>}
    <button className="save-button" onClick={onAction}><Plus size={16}/> {!goal ? "Buat target" : goal.kind === "money" ? "Tambah tabungan" : "Perbarui progres"}</button></article>
}

function GoalCard({ goal, onSave, onEdit, onDelete, onPatch }: { goal: GoalT; onSave: () => void; onEdit: () => void; onDelete: () => void; onPatch: (body: Record<string, unknown>, msg?: string) => void }) {
  const Icon = iconFor(goal.icon)
  const percent = goalPercent(goal)
  const [draft, setDraft] = useState(goal.progress)
  useEffect(() => setDraft(goal.progress), [goal.progress])
  const achieved = goal.kind === "achievement" && Boolean(goal.achievedAt)
  const deadline = goal.deadline ? ` · ${dayLabel(goal.deadline, { month: "short", year: "numeric" }).toUpperCase()}` : ""
  const commitPercent = () => { if (draft !== goal.progress) onPatch({ progress: draft }, draft >= 100 ? "Pencapaian tercapai 🏆" : "Progres disimpan") }

  return <article className={`panel glass-panel goal-card ${goal.color}`} data-card-theme={goal.theme ?? undefined}>
    <span className="goal-actions"><button className="mini-edit" aria-label={`Ubah ${goal.title}`} onClick={onEdit}><Pencil size={14}/></button><button className="mini-delete" aria-label={`Hapus ${goal.title}`} onClick={onDelete}><Trash2 size={14}/></button></span>
    <div className="goal-art"><span><Icon size={31}/></span><i/><b/></div>
    <span className="eyebrow">{goal.kind === "money" ? "TABUNGAN" : "PENCAPAIAN"}{deadline}</span><h2>{goal.title}</h2><p>{goal.note}</p>
    {goal.kind === "money" ? <>
      <div className="target-numbers"><strong>{money(goal.savedAmount)}</strong><span>dari {money(goal.targetAmount ?? 0)}</span></div>
      <div className="progress-track target-progress"><span style={{ width: `${percent}%` }}/></div>
      <div className="target-meta"><span>{percent}% terkumpul</span><span>{percent >= 100 ? "Tercapai 🎉" : `${money((goal.targetAmount ?? 0) - goal.savedAmount)} lagi`}</span></div>
      <button className="save-button" onClick={onSave}><Plus size={16}/> Tambah tabungan</button>
    </> : <>
      <div className="target-numbers"><strong>{percent}%</strong><span>{achieved ? <span className="achieved-badge"><Trophy size={11}/> Tercapai</span> : goal.progressMode === "checklist" ? `${goal.milestones.filter((m) => m.done).length} dari ${goal.milestones.length} langkah` : "progres"}</span></div>
      <div className="progress-track target-progress"><span style={{ width: `${percent}%` }}/></div>
      {goal.progressMode === "checklist" ? <div className="goal-checklist">{goal.milestones.map((m) => <button key={m.id} className={`goal-check ${m.done ? "done" : ""}`} onClick={() => onPatch({ milestones: goal.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })}><span className="box">{m.done && <Check size={11}/>}</span>{m.text}</button>)}</div>
        : !achieved && <div className="goal-percent"><input type="range" min={0} max={100} step={5} value={draft} aria-label={`Progres ${goal.title}`} onChange={(e) => setDraft(Number(e.target.value))} onPointerUp={commitPercent} onKeyUp={commitPercent} onBlur={commitPercent}/><strong>{draft}%</strong></div>}
      <button className="save-button" onClick={() => onPatch({ achieved: !achieved }, achieved ? "Ditandai belum tercapai" : "Selamat! Pencapaian tercapai 🏆")}>{achieved ? <><RefreshCw size={15}/> Tandai belum tercapai</> : <><Trophy size={15}/> Tandai tercapai</>}</button>
    </>}
  </article>
}

function ScheduleTimeline({ items, onToggle, onDelete, onEdit, onAdd }: { items: Sched[]; onToggle: (id: string, done: boolean) => void; onDelete: (id: string) => void; onEdit: (item: Sched) => void; onAdd: () => void }) {
  if (items.length === 0) return <div className="empty-state">Belum ada kegiatan di hari ini. <button className="text-link" onClick={onAdd}>Tambah kegiatan <Plus size={12}/></button></div>
  return <div className="timeline">{items.map((item) => { const Icon = iconFor(item.icon)
    return <div className={`timeline-item ${item.done ? "is-done" : ""}`} key={item.id}><div className="time-label">{item.startTime.replace(":", ".")}<small>{item.endTime.replace(":", ".")}</small></div><div className={`timeline-icon ${item.color}`}><Icon size={17}/></div><div className="event-copy"><strong>{item.title}{item.routineId && <Repeat size={10} className="inline-bell" aria-label="Rutinitas mingguan"/>}{item.remindBeforeMin !== null && <Bell size={10} className="inline-bell" aria-label="Ada pengingat"/>}</strong><span>{item.detail}</span></div>
      <button className="mini-edit" aria-label={`Ubah ${item.title}`} onClick={() => onEdit(item)}><Pencil size={13}/></button>
      <button className="mini-delete" aria-label={item.routineId ? `Lewati ${item.title} hari ini` : `Hapus ${item.title}`} title={item.routineId ? "Lewati hari ini" : "Hapus"} onClick={() => onDelete(item.id)}><Trash2 size={13}/></button>
      <button className={`check-button ${item.done ? "completed" : ""}`} aria-label={item.done ? `Tandai ${item.title} belum selesai` : `Selesaikan ${item.title}`} onClick={() => onToggle(item.id, !item.done)}>{item.done ? <Check size={14}/> : <span/>}</button></div> })}</div>
}

function TransactionsCard({ transactions, tz, today, onSeeAll, onEdit, onDelete, expanded = false }: { transactions: Tx[]; tz: string; today: string; onSeeAll?: () => void; onEdit?: (t: Tx) => void; onDelete?: (t: Tx) => void; expanded?: boolean }) {
  return <article className={`panel glass-panel transactions-panel ${expanded ? "transactions-expanded" : ""}`}><div className="panel-heading"><div><div className="eyebrow">CATATAN TERBARU</div><h2>Aktivitas uang</h2></div>{onSeeAll && <button className="round-more" aria-label="Aktivitas lainnya" onClick={onSeeAll}><MoreHorizontal size={18}/></button>}</div>
    {transactions.length === 0 ? <p className="empty-state">Belum ada transaksi. Mulai catat pemasukan atau pengeluaran pertamamu.</p> :
      <div className="transaction-list">{transactions.map((item, index) => { const w = whenLabel(item.occurredAt, tz, today)
        return <div className="transaction" key={item.id}><span className={`transaction-icon ${item.amount > 0 ? "mint" : item.goalId ? "pink" : index % 2 ? "violet" : "amber"}`}>{item.amount > 0 ? <ArrowDownLeft size={17}/> : item.goalId ? <Target size={17}/> : <CreditCard size={17}/>}</span><span className="transaction-name"><strong>{item.name}</strong><small>{w.day} · {w.time} · {item.category}</small></span><strong className={`transaction-amount ${item.amount > 0 ? "income" : ""}`}>{item.amount > 0 ? "+ " : "− "}{money(item.amount)}</strong>
          {(onEdit || onDelete) && <span className="row-actions">{onEdit && <button className="mini-edit" aria-label={`Ubah ${item.name}`} onClick={() => onEdit(item)}><Pencil size={13}/></button>}{onDelete && <button className="mini-delete" aria-label={`Hapus ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={13}/></button>}</span>}</div> })}</div>}
    {!expanded && onSeeAll && <button className="all-activity" onClick={onSeeAll}>Semua aktivitas <ArrowUpRight size={14}/></button>}</article>
}
