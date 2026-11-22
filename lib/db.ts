import "server-only"
import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

type Sql = NeonQueryFunction<false, false>

let client: Sql | null = null

/**
 * Koneksi dibuat saat query pertama, bukan saat modul di-import. Kalau dibuat saat import,
 * `next build` (yang memuat route untuk membaca konfigurasinya) gagal bila DATABASE_URL tidak
 * tersedia di tahap build, dan deploy berstatus Error walau kodenya benar.
 */
function getClient(): Sql {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error("DATABASE_URL belum diatur")
    client = neon(url)
  }
  return client
}

/** Query builder berbasis tagged template — semua nilai otomatis diparameterisasi (aman dari SQL injection). */
export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _this, args) => Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, undefined, args),
  get: (_target, prop) => {
    const value = Reflect.get(getClient(), prop)
    return typeof value === "function" ? value.bind(getClient()) : value
  },
})

export const APP_TZ = process.env.APP_TIMEZONE || "Asia/Jakarta"
