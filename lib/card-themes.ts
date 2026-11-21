// Tema animasi latar kartu. Animasinya murni CSS (app/themes.css), tanpa aset luar,
// ringan untuk baterai dan otomatis berhenti bila "kurangi gerakan" aktif di HP.

export const CARD_THEMES = [
  { key: "none", label: "Polos", emoji: "◻️" },
  { key: "rain", label: "Hujan", emoji: "🌧️" },
  { key: "water", label: "Air mengalir", emoji: "🌊" },
  { key: "bubbles", label: "Gelembung", emoji: "🫧" },
  { key: "snow", label: "Salju", emoji: "❄️" },
  { key: "stars", label: "Malam berbintang", emoji: "✨" },
  { key: "aurora", label: "Aurora", emoji: "🌌" },
  { key: "sakura", label: "Kelopak sakura", emoji: "🌸" },
  { key: "clouds", label: "Awan", emoji: "☁️" },
  { key: "school", label: "Sekolah", emoji: "🎓" },
  { key: "car", label: "Mobil di jalan", emoji: "🚗" },
  { key: "house", label: "Rumah hangat", emoji: "🏡" },
  { key: "money", label: "Hujan koin", emoji: "🪙" },
  { key: "plane", label: "Pesawat", emoji: "✈️" },
] as const

export type CardTheme = (typeof CARD_THEMES)[number]["key"]
export const CARD_THEME_KEYS = CARD_THEMES.map((t) => t.key) as [CardTheme, ...CardTheme[]]
export const MENU_KEYS = ["Ringkasan", "Keuangan", "Ibadah", "Jadwal", "Target", "Pengingat", "Pengaturan"] as const
