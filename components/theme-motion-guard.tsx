"use client"

import { useEffect } from "react"

/**
 * Hemat baterai: kartu bertema yang tidak terlihat di layar diberi atribut data-offscreen,
 * sehingga animasi partikelnya (CSS + SMIL di SVG) tidak dirender sama sekali (lihat app/themes.css).
 * Kartu baru (ganti menu, data dimuat ulang) ikut dipantau lewat MutationObserver.
 */
export function ThemeMotionGuard() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting)
      },
      { rootMargin: "80px 0px" },
    )
    const seen = new WeakSet<Element>()
    const scan = () => {
      document.querySelectorAll(".page-wrap .glass-panel").forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    }
    scan()
    let queued = false
    const mo = new MutationObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        scan()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])
  return null
}
