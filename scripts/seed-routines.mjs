// Mengisi rutinitas mingguan awal untuk SEED_USERNAME. Jalankan: node scripts/seed-routines.mjs
// Tidak menimpa: kalau user sudah punya rutinitas aktif, script berhenti.
import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local", quiet: true })
config({ quiet: true })
const sql = neon(process.env.DATABASE_URL)
const username = process.env.SEED_USERNAME || "queens"

// weekday: 0 = Minggu, 1 = Senin, ... 6 = Sabtu
const SEN_KAM = [1, 2, 3, 4]
const SEN_JUM = [1, 2, 3, 4, 5]
const SETIAP_HARI = [0, 1, 2, 3, 4, 5, 6]

const ROUTINES = [
  { days: SETIAP_HARI, start: "03:50", end: "04:20", title: "Bangun & sholat Subuh", detail: "Ikuti adzan Subuh di menu Ibadah", icon: "sparkles", color: "mint", remind: null },
  { days: SEN_JUM, start: "09:00", end: "17:00", title: "Kerja", detail: "Fokus & semangat", icon: "laptop", color: "violet", remind: 15 },
  { days: SEN_KAM, start: "17:00", end: "20:00", title: "Istirahat & rebahan", detail: "Recharge setelah kerja", icon: "coffee", color: "amber", remind: null },
  { days: SEN_KAM, start: "20:00", end: "21:00", title: "Belajar tes IQ / psikotes", detail: "Latihan soal 1 jam", icon: "book", color: "violet", remind: 10 },
  { days: SEN_KAM, start: "22:00", end: "22:30", title: "Tidur", detail: "Taruh HP, siap-siap tidur", icon: "home", color: "pink", remind: 15 },
  { days: [5], start: "17:00", end: "18:00", title: "Istirahat", detail: "Sebelum yoga", icon: "coffee", color: "amber", remind: null },
  { days: [5], start: "18:00", end: "20:00", title: "Yoga", detail: "Jumat malam, tanpa tes IQ", icon: "heart", color: "mint", remind: 15 },
  { days: [5], start: "21:00", end: "21:30", title: "Tidur", detail: "Langsung istirahat", icon: "home", color: "pink", remind: 15 },
  { days: [6], start: "09:00", end: "12:00", title: "Gym", detail: "Termasuk perjalanan", icon: "dumbbell", color: "mint", remind: 30 },
  { days: [6], start: "15:00", end: "17:00", title: "Latihan piano", detail: "2 jam latihan", icon: "music", color: "pink", remind: 15 },
  { days: [0], start: "06:00", end: "08:00", title: "Jogging pagi", detail: "Minggu pagi", icon: "dumbbell", color: "mint", remind: 15 },
  { days: [0], start: "09:00", end: "17:00", title: "Main & refreshing", detail: "Waktunya bersenang-senang", icon: "heart", color: "pink", remind: null },
]

const [user] = await sql`select id from users where username = ${username}`
if (!user) throw new Error(`User ${username} tidak ditemukan`)
const [{ count }] = await sql`select count(*)::int as count from routines where user_id = ${user.id} and active`
if (count > 0) {
  console.log(`Lewati: ${username} sudah punya ${count} rutinitas.`)
  process.exit(0)
}
let total = 0
for (const r of ROUTINES) {
  await sql`
    insert into routines (user_id, weekday, start_time, end_time, title, detail, icon, color, remind_before_min)
    select ${user.id}, d, ${r.start}::time, ${r.end}::time, ${r.title}, ${r.detail}, ${r.icon}, ${r.color}, ${r.remind}::int
    from unnest(${r.days}::int[]) as d`
  total += r.days.length
}
console.log(`✔ ${total} rutinitas mingguan ditambahkan untuk ${username}`)
