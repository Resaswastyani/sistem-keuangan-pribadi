// Definisi semua notifikasi otomatis + pesan bawaan. Semua pesan bisa di-custom oleh user
// (contoh: "Res jangan lupa sholat {sholat} dulu ya"). Dipakai di server dan client.

export type PrefGroup = "sholat" | "puasa" | "lainnya"
export type PrefDef = {
  key: string
  group: PrefGroup
  label: string
  hint: string
  enabled: boolean
  beforeMin: number | null // null = tidak bisa diatur
  atTime: string | null // null = tidak memakai jam tetap
  title: string
  body: string
  vars: string[]
}

const SHOLAT_VARS = ["nama", "sholat", "waktu", "sisa", "kota", "tanggal_hijriah"]
const sholat = (key: string, label: string, enabled = true): PrefDef => ({
  key, group: "sholat", label, hint: `Saat masuk waktu ${label}`, enabled, beforeMin: 0, atTime: null,
  title: "🕌 Waktunya sholat {sholat}",
  body: "{sholat} pukul {waktu} ({sisa}) · {kota}. Yuk sholat dulu, {nama} 🤍",
  vars: SHOLAT_VARS,
})

export const PREF_DEFS: PrefDef[] = [
  sholat("subuh", "Subuh"),
  { ...sholat("dhuha", "Dhuha", false), title: "☀️ Waktu sholat Dhuha", body: "Dhuha mulai {waktu}. Sempatkan dua rakaat, {nama} ✨" },
  sholat("dzuhur", "Dzuhur"),
  sholat("ashar", "Ashar"),
  sholat("maghrib", "Maghrib"),
  sholat("isya", "Isya"),

  { key: "sahur", group: "puasa", label: "Sahur", hint: "Menit sebelum imsak, di hari puasa", enabled: true, beforeMin: 45, atTime: null,
    title: "🍚 Waktunya sahur", body: "Imsak pukul {waktu} ({sisa}). Semangat puasanya, {nama}!", vars: ["nama", "waktu", "sisa", "kota", "tanggal_hijriah"] },
  { key: "imsak", group: "puasa", label: "Imsak", hint: "Saat imsak, di hari puasa", enabled: true, beforeMin: 0, atTime: null,
    title: "⏳ Imsak {waktu}", body: "Waktunya berhenti makan & minum. Bismillah, {nama}.", vars: ["nama", "waktu", "sisa", "kota", "tanggal_hijriah"] },
  { key: "buka", group: "puasa", label: "Berbuka", hint: "Saat maghrib, di hari puasa", enabled: true, beforeMin: 0, atTime: null,
    title: "🌙 Waktunya berbuka!", body: "Maghrib {waktu} · {kota}. Selamat berbuka, {nama}, jangan lupa doa berbuka 🤲", vars: ["nama", "waktu", "sisa", "kota", "tanggal_hijriah"] },
  { key: "puasa_sunnah", group: "puasa", label: "Puasa sunnah besok", hint: "Malam sebelum hari puasa sunnah", enabled: true, beforeMin: null, atTime: "20:00",
    title: "🌙 Besok puasa {jenis}", body: "{tanggal_hijriah}. Niatkan malam ini & siapkan sahur ya, {nama}.", vars: ["nama", "jenis", "tanggal_hijriah"] },

  { key: "digest", group: "lainnya", label: "Ringkasan malam", hint: "Rekap uang & agenda besok", enabled: true, beforeMin: null, atTime: "20:00",
    title: "🌙 Ringkasan hari ini, {nama}", body: "{ringkasan}", vars: ["nama", "ringkasan", "jumlah_transaksi", "pengeluaran", "agenda_besok"] },
  { key: "budget", group: "lainnya", label: "Peringatan anggaran", hint: "Saat pengeluaran mencapai 80% dan 100%", enabled: true, beforeMin: null, atTime: null,
    title: "💡 Anggaran sudah {persen}%", body: "Pengeluaran {terpakai} dari {anggaran}. Pelan-pelan ya, {nama}.", vars: ["nama", "persen", "terpakai", "anggaran"] },
  { key: "schedule", group: "lainnya", label: "Agenda harian", hint: "Waktu pengingat diatur di tiap kegiatan", enabled: true, beforeMin: null, atTime: null,
    title: "📅 {judul} · {waktu}", body: "Mulai {sisa}. {detail}", vars: ["nama", "judul", "waktu", "sisa", "detail"] },
]

export const PREF_KEYS = PREF_DEFS.map((d) => d.key)
export const prefDef = (key: string) => PREF_DEFS.find((d) => d.key === key)

export type Pref = { key: string; enabled: boolean; beforeMin: number; atTime: string | null; title: string | null; body: string | null }
export type EffectivePref = PrefDef & { customTitle: string | null; customBody: string | null }

/** Gabungkan bawaan + setelan user. */
export function mergePrefs(rows: Pref[]): EffectivePref[] {
  return PREF_DEFS.map((def) => {
    const row = rows.find((r) => r.key === def.key)
    return {
      ...def,
      enabled: row?.enabled ?? def.enabled,
      beforeMin: def.beforeMin === null ? null : row?.beforeMin ?? def.beforeMin,
      atTime: def.atTime === null ? null : row?.atTime ?? def.atTime,
      customTitle: row?.title ?? null,
      customBody: row?.body ?? null,
    }
  })
}

/** Isi placeholder {nama} dll, lalu rapikan spasi/tanda baca yang tertinggal jika variabel kosong. */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>) {
  return template
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? "") : m))
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/([.!?])\s*\.+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[\s·—-]+$/u, "")
}

export function renderPref(p: EffectivePref, vars: Record<string, string | number | undefined>) {
  return { title: renderTemplate(p.customTitle || p.title, vars), body: renderTemplate(p.customBody || p.body, vars) }
}

export const sisaLabel = (minutes: number) => (minutes <= 0 ? "sekarang" : minutes < 60 ? `${minutes} menit lagi` : `${Math.floor(minutes / 60)} jam ${minutes % 60 ? `${minutes % 60} menit ` : ""}lagi`)
