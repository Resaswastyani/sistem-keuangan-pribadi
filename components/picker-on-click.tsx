"use client"

import { useEffect } from "react"

const PICKER_TYPES = new Set(["date", "time", "datetime-local", "month", "week"])

/**
 * Klik di mana saja pada input tanggal/jam langsung membuka kalender/jam bawaan browser,
 * bukan hanya di ikon kecilnya, jadi tidak perlu mengetik manual.
 * (Di HP, iOS/Android memang sudah membuka picker saat disentuh; ini terutama untuk desktop.)
 */
export function PickerOnClick() {
  useEffect(() => {
    const open = (e: MouseEvent) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement) || !PICKER_TYPES.has(el.type) || el.disabled || el.readOnly) return
      try {
        el.showPicker?.()
      } catch {
        // showPicker bisa ditolak (mis. di iframe lintas origin); biarkan perilaku bawaan.
      }
    }
    document.addEventListener("click", open)
    return () => document.removeEventListener("click", open)
  }, [])
  return null
}
