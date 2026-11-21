import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/session-token"

const PUBLIC_API = ["/api/auth/login", "/api/cron/"]
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Pemeriksaan cepat sebelum request sampai ke halaman/API:
 * - halaman privat → redirect ke /login jika belum masuk
 * - API privat → 401 jika token tidak valid (route handler tetap memverifikasi ulang ke DB)
 * - proteksi CSRF: request yang mengubah data wajib berasal dari origin yang sama
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api/")
  const isPublicApi = PUBLIC_API.some((p) => pathname.startsWith(p))

  if (isApi && MUTATING.has(req.method) && !pathname.startsWith("/api/cron/")) {
    const origin = req.headers.get("origin")
    const site = req.headers.get("sec-fetch-site")
    const sameOrigin = origin ? origin === req.nextUrl.origin : site === "same-origin" || site === null
    if (!sameOrigin) return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403 })
  }

  if (isPublicApi) return NextResponse.next()

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next()
  }
  if (!session) {
    if (isApi) return NextResponse.json({ error: "Sesi berakhir, silakan masuk lagi." }, { status: 401 })
    const res = NextResponse.redirect(new URL("/login", req.url))
    res.cookies.delete(SESSION_COOKIE)
    return res
  }
  return NextResponse.next()
}

export const config = {
  // Lewati aset statis, PWA manifest, service worker, dan ikon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|apple-icon.png|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
