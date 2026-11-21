// Membuat / memperbarui akun awal + data contoh.
// Jalankan: pnpm db:seed   (membaca SEED_USERNAME & SEED_PASSWORD dari .env.local)
import { config } from "dotenv"
import bcrypt from "bcryptjs"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
config()

const { DATABASE_URL, SEED_USERNAME = "queens", SEED_PASSWORD } = process.env
if (!DATABASE_URL) throw new Error("DATABASE_URL belum diatur")
if (!SEED_PASSWORD || SEED_PASSWORD.length < 10) throw new Error("SEED_PASSWORD minimal 10 karakter")

const sql = neon(DATABASE_URL)
const hash = await bcrypt.hash(SEED_PASSWORD, 12)
const displayName = SEED_USERNAME.charAt(0).toUpperCase() + SEED_USERNAME.slice(1)

const [user] = await sql`
  insert into users (username, display_name, password_hash)
  values (${SEED_USERNAME}, ${displayName}, ${hash})
  on conflict (username) do update
    set password_hash = excluded.password_hash,
        failed_attempts = 0, locked_until = null,
        token_version = users.token_version + 1, updated_at = now()
  returning id, (xmax = 0) as inserted`

console.log(`✔ Akun "${SEED_USERNAME}" ${user.inserted ? "dibuat" : "diperbarui (password di-reset)"}`)

const [{ count }] = await sql`select count(*)::int as count from goals where user_id = ${user.id}`
if (count === 0) {
  await sql`insert into goals (user_id, title, note, target_amount, saved_amount, deadline, color, icon) values
    (${user.id}, 'Headphone impian', 'Hadiah kecil untuk dirimu sendiri.', 5000000, 0, '2026-12-31', 'goal-pink', 'headphones'),
    (${user.id}, 'Laptop untuk belajar', 'Upgrade untuk ide-ide berikutnya.', 11000000, 0, '2027-03-31', 'goal-lilac', 'laptop'),
    (${user.id}, 'Dana liburan', 'Waktu istirahat yang kamu nantikan.', 3000000, 0, '2027-06-30', 'goal-peach', 'plane')`
  console.log("✔ Target contoh ditambahkan (saldo masih 0, isi lewat aplikasi)")
}
