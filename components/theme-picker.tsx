"use client"

import { useState } from "react"
import { CARD_THEMES } from "@/lib/card-themes"

/** Grid pratinjau tema animasi. Dipakai di form (lewat input hidden `name`) atau terkontrol (value/onChange). */
export function ThemePicker({ name, defaultValue, value, onChange, allowInherit = false }: { name?: string; defaultValue?: string | null; value?: string | null; onChange?: (v: string | null) => void; allowInherit?: boolean }) {
  const [inner, setInner] = useState<string | null>(defaultValue ?? (allowInherit ? null : "none"))
  const current = value !== undefined ? value : inner
  const pick = (v: string | null) => { setInner(v); onChange?.(v) }
  return <div className="theme-picker">
    {name && <input type="hidden" name={name} value={current ?? ""}/>}
    {allowInherit && <button type="button" className={`theme-swatch-btn ${current === null ? "on" : ""}`} onClick={() => pick(null)} aria-pressed={current === null}><span className="theme-swatch inherit">↺</span><small>Ikut menu</small></button>}
    {CARD_THEMES.map((t) => <button type="button" key={t.key} className={`theme-swatch-btn ${current === t.key ? "on" : ""}`} onClick={() => pick(t.key)} aria-pressed={current === t.key}>
      <span className="theme-swatch" data-card-theme={t.key}><b>{t.emoji}</b></span><small>{t.label}</small>
    </button>)}
  </div>
}
