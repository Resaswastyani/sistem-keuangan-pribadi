"use client"

import { BrandMark } from "@/components/brand-mark"
import { ArrowRight, Eye, EyeOff, Flower2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/client-api"

export function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return
    const f = new FormData(e.currentTarget)
    setLoading(true)
    setError("")
    try {
      await api("/api/auth/login", { method: "POST", body: { username: String(f.get("username") ?? ""), password: String(f.get("password") ?? "") } })
      window.location.replace("/")
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  const brand = <a className="brand" href="/"><BrandMark/><span>mellow<span className="brand-dot">.</span><small>YOUR LIFE, IN FLOW</small></span></a>

  return <main className="login-page"><div className="login-backdrop"><span className="blob blob-a"/><span className="blob blob-b"/><span className="blob blob-c"/></div><section className="login-frame glass-panel">
    <div className="login-visual"><div className="login-brand">{brand}</div><div className="visual-copy"><span className="visual-kicker"><Flower2 size={14}/> A LITTLE SPACE, JUST FOR YOU</span><h1>Hidup yang lebih teratur, <em>tanpa kehilangan ritmenya.</em></h1><p>Tempat kecil untuk merawat rencana, uang, dan waktu yang berarti.</p></div><div className="visual-bottom"><div className="mini-orbit"><span>✳</span><i/><b/></div><span>Hari ini adalah awal yang baik.<br/><strong>Jalani dengan caramu.</strong></span></div><span className="login-glass-orb"/></div>
    <div className="login-form-side"><div className="mobile-login-brand">{brand}</div>
      <div className="form-head"><span className="eyebrow">SENANG KAMU KEMBALI</span><h2>Selamat datang.</h2><p>Masuk ke ruang pribadimu dan lanjutkan langkah kecilmu.</p></div>
      <form className="login-form" onSubmit={submit} noValidate>
        <label htmlFor="username">Username</label>
        <div className="input-wrap"><UserRound size={17}/><input id="username" name="username" type="text" placeholder="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={64} required/></div>
        <div className="label-row"><label htmlFor="password">Kata sandi</label></div>
        <div className="input-wrap"><LockKeyhole size={17}/><input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Masukkan kata sandi" autoComplete="current-password" maxLength={200} required/><button type="button" className="reveal-button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={loading}>{loading ? "Memeriksa…" : "Masuk ke ruangku"} <ArrowRight size={17}/></button>
      </form>
      <p className="login-footnote"><ShieldCheck size={13}/> Ruang pribadi · sesi terenkripsi & terlindungi dari percobaan berulang.</p>
    </div>
  </section></main>
}
