import "server-only"
import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diatur")

/** Query builder berbasis tagged template — semua nilai otomatis diparameterisasi (aman dari SQL injection). */
export const sql = neon(process.env.DATABASE_URL)

export const APP_TZ = process.env.APP_TIMEZONE || "Asia/Jakarta"
