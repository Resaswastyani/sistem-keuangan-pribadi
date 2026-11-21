// Jalankan: pnpm db:migrate
import { config } from "dotenv"
import { readFileSync } from "node:fs"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })
config()

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diatur")
const sql = neon(process.env.DATABASE_URL)

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
const statements = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean)

for (const statement of statements) await sql.query(statement)
console.log(`✔ Migrasi selesai (${statements.length} statement)`)
