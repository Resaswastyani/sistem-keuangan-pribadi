// Generator app/themes.css — tema animasi latar kartu (CSS + SVG inline, tanpa aset luar).
// Jalankan: node scripts/build-themes.mjs
//
// Cara kerja:
// - [data-card-theme="x"] mengisi variabel CSS (--tb-* untuk ::before, --ta-* untuk ::after).
//   Variabel diwariskan, jadi tema per-menu (di .page-wrap) bisa ditimpa tema per-kartu (mis. target).
// - Setiap tema dibuat dua kali dari geometri yang sama: palet gelap & palet terang. Di mode terang
//   partikel putih tidak akan terlihat di kartu putih, jadi warnanya dipergelap + diberi "langit" (tint).
// - Kesan nyata: 2–5 lapis kedalaman (parallax: lapis jauh kecil, pudar, lambat), posisi acak (seeded),
//   ayunan (sway) untuk salju/kelopak/gelembung, dan animasi per partikel lewat SMIL di dalam SVG
//   (kerlip bintang, cipratan hujan, koin berputar, kelopak berputar, roda mobil, asap cerobong).
// - Agar loop mulus, setiap lapis bergeser kelipatan ukuran tile-nya dalam satu siklus.
import { writeFileSync } from "node:fs"

// Escape minimal (bukan encodeURIComponent) supaya CSS tetap kecil: cukup % # < > " dan whitespace.
const svg = (w, h, body, attrs = "") =>
  `url("data:image/svg+xml,${`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'${attrs}>${body}</svg>`
    .replace(/\s+/g, " ").replace(/> </g, "><")
    .replace(/[%#<>"]/g, (ch) => encodeURIComponent(ch))}")`

// ---------- util ----------
const R = (seed) => {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const n1 = (v) => Math.round(v * 10) / 10
const rgba = (c, a) => `rgba(${c},${Math.round(Math.min(1, a) * 100) / 100})`
const uniq = (a) => [...new Set(a)]
/** Gambar elemen + salinannya di sisi seberang bila menyentuh tepi, supaya tile menyambung mulus. */
const wrap = (W, H, x, y, ext, draw) => {
  let out = ""
  for (const dx of uniq([0, x - ext < 0 ? W : 0, x + ext > W ? -W : 0]))
    for (const dy of uniq([0, y - ext < 0 ? H : 0, y + ext > H ? -H : 0])) out += draw(x + dx, y + dy)
  return out
}
const N = 8
const FPS = 30
/** Lintasan satu siklus: geser (dx, dy) + ayunan sinus. Ayunan kembali ke 0 di akhir → loop mulus. */
const path = (dx, dy, amp = 0, waves = 1) =>
  Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N
    return [n1(dx * t + amp * Math.sin(2 * Math.PI * waves * t)), n1(dy * t)]
  })
const STILL = path(0, 0)
const smil = (attr, values, dur, begin = 0, extra = "") =>
  `<animate attributeName='${attr}' values='${values}' dur='${n1(dur)}s' begin='${n1(begin)}s' repeatCount='indefinite'${extra}/>`

// ---------- palet ----------
const PAL = {
  dark: {
    rain: "205,225,255", rainA: 0.6,
    snowCore: "255,255,255", snowEdge: "220,232,255", snowA: 0.9,
    bubble: "205,235,255", irA: "255,170,220", irB: "140,230,255", hi: "255,255,255",
    star: "255,250,235", starHot: "255,232,190", streak: "255,240,220",
    aurora: ["120,240,190", "245,140,205", "160,140,255"], auroraA: 0.42,
    petalTip: "#fff0f5", petalBase: "#f39bbf", petalA: 0.85,
    cloudTop: "255,255,255", cloudBot: "205,212,238", cloudA: 0.22,
    wave: ["120,200,240", "90,170,230", "70,150,220"], waveA: [0.13, 0.17, 0.24], crest: "225,245,255", glint: "255,255,255",
    ink: "255,240,215", inkA: 0.28, ruled: "170,200,255", ruledA: 0.1, margin: "255,140,165", marginA: 0.2,
    mountain: "160,150,210", mountainA: 0.16, hill: "150,205,170", hillA: 0.2, tree: "130,190,150", treeA: 0.42,
    road: "rgba(16,13,20,.62)", roadEdge: "rgba(255,255,255,.14)", dash: "rgba(255,232,160,.75)",
    moon: "#fff3d6", moonGlow: "255,236,190", firefly: "255,226,140",
    coinRim: "#b6862a",
    plane: ["#f7f8fc", "#b8c0d2"], planeLine: "rgba(255,255,255,0)", trail: "255,255,255", trailA: 0.5,
    tints: {
      rain: "linear-gradient(180deg, rgba(90,120,175,.18), rgba(90,120,175,.04))",
      water: "linear-gradient(180deg, transparent 35%, rgba(100,180,230,.14))",
      bubbles: "radial-gradient(ellipse at 50% 120%, rgba(110,190,235,.2), transparent 70%)",
      snow: "linear-gradient(180deg, rgba(190,210,255,.1), rgba(190,210,255,.02))",
      stars: "radial-gradient(ellipse at 70% 0%, rgba(120,100,215,.24), rgba(20,14,40,.18) 70%)",
      aurora: "linear-gradient(180deg, rgba(20,30,60,.22), transparent)",
      sakura: "linear-gradient(160deg, rgba(255,180,210,.12), transparent 60%)",
      clouds: "linear-gradient(180deg, rgba(110,150,225,.18), transparent 75%)",
      school: "linear-gradient(180deg, rgba(90,140,110,.08), rgba(90,140,110,.02))",
      car: "linear-gradient(180deg, rgba(150,190,255,.12), transparent 70%)",
      house: "radial-gradient(ellipse at 85% 100%, rgba(255,200,130,.18), rgba(60,50,110,.12) 60%)",
      money: "radial-gradient(ellipse at 50% 0%, rgba(243,215,126,.16), transparent 65%)",
      plane: "linear-gradient(180deg, rgba(130,185,255,.16), transparent 75%)",
    },
  },
  light: {
    rain: "55,105,175", rainA: 0.55,
    snowCore: "238,244,255", snowEdge: "100,132,190", snowA: 1,
    bubble: "60,135,200", irA: "230,90,170", irB: "40,170,220", hi: "255,255,255",
    star: "115,75,185", starHot: "215,145,30", streak: "135,95,205",
    aurora: ["30,180,130", "220,80,155", "110,85,220"], auroraA: 0.4,
    petalTip: "#ffd6e5", petalBase: "#e2689a", petalA: 0.9,
    cloudTop: "255,255,255", cloudBot: "188,204,230", cloudA: 0.95,
    wave: ["110,180,232", "75,150,215", "50,125,200"], waveA: [0.24, 0.3, 0.38], crest: "255,255,255", glint: "255,255,255",
    ink: "125,80,112", inkA: 0.3, ruled: "110,150,215", ruledA: 0.22, margin: "228,100,135", marginA: 0.38,
    mountain: "130,120,190", mountainA: 0.24, hill: "90,165,115", hillA: 0.3, tree: "60,130,85", treeA: 0.55,
    road: "rgba(85,74,96,.45)", roadEdge: "rgba(255,255,255,.7)", dash: "rgba(255,255,255,.95)",
    moon: "#fff6dc", moonGlow: "255,190,120", firefly: "235,165,40",
    coinRim: "#9c6f18",
    plane: ["#ffffff", "#aeb8cc"], planeLine: "rgba(70,80,110,.45)", trail: "120,145,195", trailA: 0.55,
    tints: {
      rain: "linear-gradient(180deg, rgba(120,150,205,.28), rgba(160,185,225,.1))",
      water: "linear-gradient(180deg, rgba(205,232,250,.12) 25%, rgba(110,180,230,.26))",
      bubbles: "radial-gradient(ellipse at 50% 120%, rgba(100,175,230,.32), rgba(200,230,250,.1) 75%)",
      snow: "linear-gradient(180deg, rgba(165,192,235,.34), rgba(205,222,245,.12))",
      stars: "linear-gradient(180deg, rgba(160,138,228,.36), rgba(255,200,222,.16))",
      aurora: "linear-gradient(180deg, rgba(200,215,250,.25), rgba(240,225,250,.1))",
      sakura: "linear-gradient(160deg, rgba(255,190,215,.3), rgba(255,236,243,.06))",
      clouds: "linear-gradient(180deg, rgba(135,182,240,.42), rgba(200,225,250,.14))",
      school: "linear-gradient(180deg, rgba(255,250,232,.7), rgba(255,245,222,.45))",
      car: "linear-gradient(180deg, rgba(155,198,250,.34), rgba(225,238,252,.06) 70%)",
      house: "linear-gradient(180deg, rgba(185,165,235,.3), rgba(255,212,185,.26))",
      money: "radial-gradient(ellipse at 50% 0%, rgba(240,200,90,.3), rgba(255,240,200,.08) 70%)",
      plane: "linear-gradient(180deg, rgba(135,187,245,.4), rgba(210,230,250,.1))",
    },
  },
}

// ---------- SVG: hujan ----------
const rainTile = (c, seed, W, H, n, len, w, a, slant) => {
  const r = R(seed)
  let b = `<defs><linearGradient id='d' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${rgba(c.rain, 0)}'/><stop offset='1' stop-color='${rgba(c.rain, a)}'/></linearGradient></defs>`
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, l = len * (0.7 + r() * 0.6)
    b += wrap(W, H, x, y, l + 2, (X, Y) => `<line x1='${n1(X)}' y1='${n1(Y)}' x2='${n1(X - l * slant)}' y2='${n1(Y + l)}' stroke='url(#d)' stroke-width='${w}' stroke-linecap='round'/>`)
  }
  return svg(W, H, b)
}
const splashTile = (c) => {
  const r = R(7)
  let b = ""
  for (let i = 0; i < 8; i++) {
    const x = n1(10 + r() * 240), y = n1(20 + r() * 8), d = 0.6 + r() * 0.7, bg = -r() * d
    b += `<ellipse cx='${x}' cy='${y}' rx='0' ry='0' fill='none' stroke='${rgba(c.rain, c.rainA)}' stroke-width='.8'>${smil("rx", "0;8", d, bg)}${smil("ry", "0;2", d, bg)}${smil("opacity", "1;0", d, bg)}</ellipse>`
    b += `<circle cx='${x}' cy='${y}' r='.9' fill='${rgba(c.rain, c.rainA)}'>${smil("cy", `${y};${n1(y - 6)};${y}`, d, bg)}${smil("opacity", "0;1;0", d, bg)}</circle>`
  }
  return svg(260, 32, b)
}

// ---------- SVG: salju ----------
const snowTile = (c, seed, S, n, rMin, rMax, crystals = 0) => {
  const r = R(seed)
  let b = `<defs><radialGradient id='f'><stop offset='0' stop-color='${rgba(c.snowCore, c.snowA)}'/><stop offset='.45' stop-color='${rgba(c.snowCore, c.snowA * 0.85)}'/><stop offset='.7' stop-color='${rgba(c.snowEdge, c.snowA * 0.55)}'/><stop offset='1' stop-color='${rgba(c.snowEdge, 0)}'/></radialGradient></defs>`
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin)
    if (i < crystals) {
      const s = rad * 2.2, rot = Math.round(r() * 60)
      const arm = `<line x1='0' y1='0' x2='0' y2='${-s}'/><line x1='0' y1='${n1(-s * 0.55)}' x2='${n1(s * 0.28)}' y2='${n1(-s * 0.8)}'/><line x1='0' y1='${n1(-s * 0.55)}' x2='${n1(-s * 0.28)}' y2='${n1(-s * 0.8)}'/>`
      b += wrap(S, S, x, y, s + 2, (X, Y) => `<g transform='translate(${n1(X)} ${n1(Y)}) rotate(${rot})' stroke='${rgba(c.snowEdge, c.snowA)}' stroke-width='.9' stroke-linecap='round'>${[0, 60, 120, 180, 240, 300].map((a) => `<g transform='rotate(${a})'>${arm}</g>`).join("")}<animateTransform attributeName='transform' type='rotate' additive='sum' from='0' to='360' dur='${n1(8 + r() * 6)}s' repeatCount='indefinite'/></g>`)
    } else b += wrap(S, S, x, y, rad * 2, (X, Y) => `<circle cx='${n1(X)}' cy='${n1(Y)}' r='${n1(rad * 1.6)}' fill='url(#f)'/>`)
  }
  return svg(S, S, b)
}

// ---------- SVG: gelembung ----------
const bubbleTile = (c, seed, S, n, rMin, rMax) => {
  const r = R(seed)
  let b = `<defs><radialGradient id='b' cx='.5' cy='.5' r='.5'><stop offset='0' stop-color='${rgba(c.bubble, 0.02)}'/><stop offset='.72' stop-color='${rgba(c.bubble, 0.08)}'/><stop offset='.93' stop-color='${rgba(c.bubble, 0.5)}'/><stop offset='1' stop-color='${rgba(c.bubble, 0.1)}'/></radialGradient><linearGradient id='i' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${rgba(c.irA, 0.55)}'/><stop offset='.5' stop-color='${rgba(c.bubble, 0.1)}'/><stop offset='1' stop-color='${rgba(c.irB, 0.55)}'/></linearGradient></defs>`
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin), d = 1.6 + r() * 1.4
    b += wrap(S, S, x, y, rad + 2, (X, Y) => `<g transform='translate(${n1(X)} ${n1(Y)})'><circle r='${n1(rad)}' fill='url(#b)'>${smil("r", `${n1(rad)};${n1(rad * 1.04)};${n1(rad)}`, d)}</circle><circle r='${n1(rad)}' fill='none' stroke='url(#i)' stroke-width='.8'/><ellipse cx='${n1(-rad * 0.36)}' cy='${n1(-rad * 0.38)}' rx='${n1(rad * 0.3)}' ry='${n1(rad * 0.16)}' transform='rotate(-35 ${n1(-rad * 0.36)} ${n1(-rad * 0.38)})' fill='${rgba(c.hi, 0.75)}'/><circle cx='${n1(rad * 0.4)}' cy='${n1(rad * 0.42)}' r='${n1(Math.max(0.6, rad * 0.08))}' fill='${rgba(c.hi, 0.6)}'/></g>`)
  }
  return svg(S, S, b)
}

// ---------- SVG: bintang ----------
const starField = (c, seed, S) => {
  const r = R(seed)
  let b = `<defs><radialGradient id='h'><stop offset='0' stop-color='${rgba(c.starHot, 0.7)}'/><stop offset='1' stop-color='${rgba(c.starHot, 0)}'/></radialGradient></defs>`
  for (let i = 0; i < 38; i++) {
    const x = r() * S, y = r() * S, rad = 0.3 + r() * 0.5, a = 0.3 + r() * 0.4
    b += `<circle cx='${n1(x)}' cy='${n1(y)}' r='${n1(rad)}' fill='${rgba(c.star, a)}'/>`
  }
  for (let i = 0; i < 12; i++) {
    const x = r() * S, y = r() * S, rad = 0.8 + r() * 0.7, d = 2 + r() * 3.5
    b += `<circle cx='${n1(x)}' cy='${n1(y)}' r='${n1(rad)}' fill='${rgba(c.star, 0.95)}'>${smil("opacity", "1;.2;1", d, -r() * d)}</circle>`
  }
  for (let i = 0; i < 3; i++) {
    const x = 20 + r() * (S - 40), y = 20 + r() * (S - 40), d = 3 + r() * 3
    b += `<g transform='translate(${n1(x)} ${n1(y)})'>${smil("opacity", "1;.35;1", d, -r() * d)}<circle r='7' fill='url(#h)'/><path d='M0 -6 L.7 -.7 L6 0 L.7 .7 L0 6 L-.7 .7 L-6 0 L-.7 -.7Z' fill='${rgba(c.star, 1)}'/><circle r='1.3' fill='${rgba(c.star, 1)}'/></g>`
  }
  return svg(S, S, b)
}
const shootingStar = (c) => svg(150, 70, `<defs><linearGradient id='g' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='${rgba(c.streak, 0)}'/><stop offset='1' stop-color='${rgba(c.streak, 0.95)}'/></linearGradient><radialGradient id='k'><stop offset='0' stop-color='${rgba(c.streak, 1)}'/><stop offset='1' stop-color='${rgba(c.streak, 0)}'/></radialGradient></defs><line x1='6' y1='64' x2='138' y2='10' stroke='url(#g)' stroke-width='1.8' stroke-linecap='round'/><circle cx='138' cy='10' r='5' fill='url(#k)'/>`)

// ---------- SVG: aurora ----------
const curtain = (col, a, W, H, k, phase, base, amp) => {
  const pts = []
  // Tirai digambar dari -W sampai 2W (gelombangnya periodik), tapi yang tampil hanya 0..W.
  // Jadi tepi blur jatuh di luar tile dan tidak ada sambungan saat tile diulang (repeat-x).
  for (let x = -W; x <= 2 * W; x += 10) pts.push([x, n1(base + amp * Math.sin((2 * Math.PI * k * x) / W + phase))])
  const top = pts.map(([x, y]) => `${x} ${n1(y - H * 0.42 - amp * 0.6 * Math.sin((2 * Math.PI * k * x) / W + phase * 1.7))}`)
  const d = `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")} L${top.reverse().join(" L")} Z`
  // Blur ada di dalam SVG (dirasterisasi sekali), bukan filter CSS yang dihitung ulang tiap frame.
  return svg(W, H, `<defs><linearGradient id='a' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${rgba(col, 0)}'/><stop offset='.65' stop-color='${rgba(col, a * 0.6)}'/><stop offset='.92' stop-color='${rgba(col, a)}'/><stop offset='1' stop-color='${rgba(col, a * 0.3)}'/></linearGradient><filter id='s' filterUnits='userSpaceOnUse' x='${-W}' y='${-H}' width='${3 * W}' height='${3 * H}'><feGaussianBlur stdDeviation='5'/></filter></defs><path d='${d}' fill='url(#a)' filter='url(#s)'/>`, " preserveAspectRatio='none'")
}

// ---------- SVG: sakura ----------
const petalTile = (c, seed, S, n, sMin, sMax) => {
  const r = R(seed)
  let b = `<defs><radialGradient id='p' cx='.5' cy='1' r='1'><stop offset='0' stop-color='${c.petalBase}'/><stop offset='.85' stop-color='${c.petalTip}'/></radialGradient></defs>`
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, s = sMin + r() * (sMax - sMin), rot = Math.round(r() * 360), d = 2.5 + r() * 4, fd = 1.6 + r() * 2
    b += wrap(S, S, x, y, 12 * s, (X, Y) => `<g transform='translate(${n1(X)} ${n1(Y)}) scale(${n1(s)})' opacity='${c.petalA}'><g><path d='M0 9 C -6 5,-7 -3,-3 -8 L0 -5.5 L3 -8 C 7 -3,6 5,0 9Z' fill='url(#p)'/><path d='M0 8 L0 -4' stroke='${c.petalBase}' stroke-width='.4' opacity='.5'/><animateTransform attributeName='transform' type='rotate' from='${rot}' to='${rot + 360}' dur='${n1(d)}s' repeatCount='indefinite'/><animateTransform attributeName='transform' type='scale' additive='sum' values='1 1;1 .25;1 1' dur='${n1(fd)}s' repeatCount='indefinite'/></g></g>`)
  }
  return svg(S, S, b)
}

// ---------- SVG: awan ----------
const cloudShape = (r, cx, cy, s) => {
  let puffs = ""
  const n = 6 + Math.floor(r() * 3)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x = cx + (t - 0.5) * 90 * s, y = cy - Math.sin(Math.PI * t) * 16 * s + (r() - 0.5) * 6 * s, rad = (14 + Math.sin(Math.PI * t) * 12 + r() * 6) * s
    puffs += `<circle cx='${n1(x)}' cy='${n1(y)}' r='${n1(rad)}'/>`
  }
  return `${puffs}<rect x='${n1(cx - 50 * s)}' y='${n1(cy - 4 * s)}' width='${n1(100 * s)}' height='${n1(16 * s)}' rx='${n1(8 * s)}'/>`
}
const cloudTile = (c, seed, W, H, items, a = 1) => {
  const r = R(seed)
  return svg(W, H, `<defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${rgba(c.cloudTop, c.cloudA * a)}'/><stop offset='1' stop-color='${rgba(c.cloudBot, c.cloudA * a * 0.9)}'/></linearGradient><filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='1.6'/></filter></defs><g fill='url(#c)' filter='url(#s)'>${items.map(([x, y, s]) => cloudShape(r, x, y, s)).join("")}</g>`)
}

// ---------- SVG: air ----------
const waveTile = (col, a, W, H, A, k, phase, crest) => {
  const pts = []
  for (let x = 0; x <= W; x += 8) pts.push(`${x} ${n1(H * 0.38 + A * Math.sin((2 * Math.PI * k * x) / W + phase))}`)
  const line = `M${pts.join(" L")}`
  return svg(W, H, `<defs><linearGradient id='w' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${rgba(col, a * 0.7)}'/><stop offset='1' stop-color='${rgba(col, a * 1.5)}'/></linearGradient></defs><path d='${line} L${W} ${H} L0 ${H} Z' fill='url(#w)'/>${crest ? `<path d='${line}' fill='none' stroke='${crest}' stroke-width='1.1'/>` : ""}`)
}
const glintTile = (c) => {
  const r = R(91)
  let b = ""
  for (let i = 0; i < 7; i++) {
    const x = n1(10 + r() * 220), y = n1(30 + r() * 26), d = 1.4 + r() * 2.2, s = n1(1.6 + r() * 1.8)
    b += `<path transform='translate(${x} ${y})' d='M0 -${s} L.5 -.5 L${s} 0 L.5 .5 L0 ${s} L-.5 .5 L-${s} 0 L-.5 -.5Z' fill='${rgba(c.glint, 0.95)}' opacity='0'>${smil("opacity", "0;1;0;0", d, -r() * d)}</path>`
  }
  return svg(240, 64, b)
}

// ---------- SVG: sekolah ----------
const schoolTile = (c) => {
  const ink = rgba(c.ink, c.inkA)
  return svg(240, 240, [
    `<g transform='translate(20 30)' fill='none' stroke='${ink}' stroke-width='1.4' stroke-linejoin='round'><path d='M0 4 Q12 0 24 4 V24 Q12 20 0 24Z'/><path d='M24 4 Q36 0 48 4 V24 Q36 20 24 24Z'/><path d='M5 9 H19 M5 14 H19 M29 9 H43 M29 14 H43' stroke-width='.8'/></g>`,
    `<g transform='translate(150 26) rotate(35)' fill='none' stroke='${ink}' stroke-width='1.4'><rect x='0' y='0' width='40' height='8' rx='1.5'/><path d='M40 0 L50 4 L40 8'/><line x1='8' y1='0' x2='8' y2='8'/></g>`,
    `<g transform='translate(96 116)' fill='none' stroke='${ink}' stroke-width='1.4' stroke-linejoin='round'><path d='M0 10 L24 0 L48 10 L24 20 Z'/><path d='M10 14 V24 Q24 32 38 24 V14'/><path d='M44 12 V26'/></g>`,
    `<g transform='translate(20 168) rotate(-15)' fill='none' stroke='${ink}' stroke-width='1.3'><rect x='0' y='0' width='56' height='12' rx='2'/>${[8, 16, 24, 32, 40, 48].map((x) => `<line x1='${x}' y1='0' x2='${x}' y2='${x % 16 ? 4 : 7}'/>`).join("")}</g>`,
    `<g transform='translate(186 120)' fill='none' stroke='${ink}' stroke-width='1.2'><circle r='3'/><ellipse rx='14' ry='5'/><ellipse rx='14' ry='5' transform='rotate(60)'/><ellipse rx='14' ry='5' transform='rotate(-60)'/></g>`,
    `<text x='170' y='200' font-family='Georgia,serif' font-size='20' font-weight='700' fill='${ink}'>A+</text>`,
    `<text x='92' y='70' font-family='Georgia,serif' font-style='italic' font-size='13' fill='${ink}'>a²+b²=c²</text>`,
    `<path d='M206 64 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z' fill='${ink}'/>`,
  ].join(""))
}

// ---------- SVG: jalan & mobil ----------
const mountainTile = (c) => svg(600, 100, `<path d='M0 100 L0 70 L70 30 L120 55 L190 12 L260 60 L330 34 L400 62 L470 22 L540 58 L600 70 L600 100Z' fill='${rgba(c.mountain, c.mountainA)}'/><path d='M190 12 L176 22 L186 20 L194 26 L204 21Z M470 22 L458 31 L468 29 L476 34 L484 30Z' fill='${rgba(c.snowCore, c.mountainA * 2.2)}'/>`)
const hillTile = (c) => svg(420, 60, `<path d='M0 60 L0 34 Q60 6 120 30 T240 24 T360 28 T420 34 V60Z' fill='${rgba(c.hill, c.hillA)}'/>`)
const treeTile = (c) => {
  const r = R(55)
  let b = ""
  for (let x = 10; x < 310; x += 40 + r() * 50) {
    const h = 22 + r() * 22, fill = rgba(c.tree, c.treeA * (0.75 + r() * 0.35))
    b += r() > 0.45
      ? `<g transform='translate(${n1(x)} 56)'><rect x='-1.2' y='-6' width='2.4' height='6' fill='${fill}'/><path d='M0 ${n1(-h)} L${n1(h * 0.28)} ${n1(-h * 0.45)} L${n1(h * 0.16)} ${n1(-h * 0.45)} L${n1(h * 0.36)} -5 L${n1(-h * 0.36)} -5 L${n1(-h * 0.16)} ${n1(-h * 0.45)} L${n1(-h * 0.28)} ${n1(-h * 0.45)}Z' fill='${fill}'/></g>`
      : `<g transform='translate(${n1(x)} 56)'><rect x='-1.3' y='-9' width='2.6' height='9' fill='${fill}'/><circle cy='${n1(-h * 0.6)}' r='${n1(h * 0.36)}' fill='${fill}'/></g>`
  }
  return svg(320, 56, b)
}
const roadTile = (c) => svg(400, 30, `<rect y='4' width='400' height='26' fill='${c.road}'/><rect y='3' width='400' height='1.6' fill='${c.roadEdge}'/>`)
const dashTile = (c) => svg(50, 4, `<rect width='24' height='3' rx='1.5' fill='${c.dash}'/>`)
const wheel = (cx) => `<g transform='translate(${cx} 37)'><circle r='7.2' fill='#1c171f'/><circle r='4.4' fill='#d3d7de'/><g stroke='#7b8190' stroke-width='1.1' stroke-linecap='round'><line x1='-3.6' y1='0' x2='3.6' y2='0'/><line x1='0' y1='-3.6' x2='0' y2='3.6'/><line x1='-2.5' y1='-2.5' x2='2.5' y2='2.5'/><line x1='-2.5' y1='2.5' x2='2.5' y2='-2.5'/><animateTransform attributeName='transform' type='rotate' from='0' to='360' dur='.35s' repeatCount='indefinite'/></g><circle r='1.3' fill='#5b5f69'/></g>`
const carSvg = svg(110, 48, `<defs>
<linearGradient id='body' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f8bfd6'/><stop offset='.55' stop-color='#ea8fb3'/><stop offset='1' stop-color='#c96a92'/></linearGradient>
<linearGradient id='glass' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e8f3ff'/><stop offset='1' stop-color='#8fa9c9'/></linearGradient>
<radialGradient id='lamp' cx='0' cy='.5' r='1'><stop offset='0' stop-color='rgba(255,236,170,.75)'/><stop offset='1' stop-color='rgba(255,236,170,0)'/></radialGradient>
<radialGradient id='shadow'><stop offset='0' stop-color='rgba(0,0,0,.35)'/><stop offset='1' stop-color='rgba(0,0,0,0)'/></radialGradient></defs>
<ellipse cx='45' cy='44' rx='40' ry='4' fill='url(#shadow)'/>
<path d='M84 26 Q96 28 110 30 L110 22 Q96 22 84 24Z' fill='url(#lamp)'/>
<path d='M6 34 Q5 24 14 22 L26 21 L36 11 Q40 7 47 7 H60 Q67 7 72 12 L80 20 Q86 21 87 26 V34 Q87 37 84 37 H8 Q6 37 6 34Z' fill='url(#body)'/>
<path d='M38 12 Q41 10 46 10 H52 V20 H29Z M55 10 H60 Q65 10 69 14 L74 20 H55Z' fill='url(#glass)'/>
<path d='M53 10 V34' stroke='rgba(120,50,85,.35)' stroke-width='.8'/>
<rect x='82' y='24' width='5' height='3.5' rx='1.2' fill='#fff2b8'/><rect x='6' y='25' width='3.5' height='3.5' rx='1' fill='#ff6f86'/>
<path d='M14 23 H80' stroke='rgba(255,255,255,.45)' stroke-width='.8'/>
${wheel(22)}${wheel(70)}`)

// ---------- SVG: rumah ----------
const moonSvg = (c) => svg(56, 56, `<defs><radialGradient id='g'><stop offset='.35' stop-color='${rgba(c.moonGlow, 0.5)}'/><stop offset='1' stop-color='${rgba(c.moonGlow, 0)}'/></radialGradient><radialGradient id='m' cx='.4' cy='.35'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='${c.moon}'/></radialGradient></defs><circle cx='28' cy='28' r='27' fill='url(#g)'/><circle cx='28' cy='28' r='11' fill='url(#m)'/><circle cx='24' cy='25' r='2.2' fill='rgba(200,180,150,.35)'/><circle cx='31' cy='32' r='1.6' fill='rgba(200,180,150,.3)'/><circle cx='32' cy='23' r='1.1' fill='rgba(200,180,150,.3)'/>`)
const fireflyTile = (c) => {
  const r = R(303)
  let b = `<defs><radialGradient id='f'><stop offset='0' stop-color='${rgba(c.firefly, 1)}'/><stop offset='.3' stop-color='${rgba(c.firefly, 0.6)}'/><stop offset='1' stop-color='${rgba(c.firefly, 0)}'/></radialGradient></defs>`
  for (let i = 0; i < 6; i++) {
    const x = n1(r() * 200), y = n1(60 + r() * 80), d = 2.5 + r() * 3, mx = n1(x + (r() - 0.5) * 18), my = n1(y + (r() - 0.5) * 14)
    b += `<circle cx='${x}' cy='${y}' r='4' fill='url(#f)' opacity='0'>${smil("opacity", "0;1;.2;0", d, -r() * d)}${smil("cx", `${x};${mx};${x}`, d * 2)}${smil("cy", `${y};${my};${y}`, d * 2.3)}</circle>`
  }
  return svg(200, 160, b)
}
const smoke = (begin) => `<circle cx='0' cy='0' r='4' fill='rgba(235,230,240,.4)'>${smil("cy", "0;-30", 3.6, begin)}${smil("cx", "0;4;-2", 3.6, begin)}${smil("r", "3;9", 3.6, begin)}${smil("opacity", ".55;0", 3.6, begin)}</circle>`
const houseSvg = svg(130, 118, `<defs>
<linearGradient id='roof' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#f2a8c6'/><stop offset='1' stop-color='#c86f97'/></linearGradient>
<linearGradient id='wall' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#5d4562'/><stop offset='1' stop-color='#3b2b40'/></linearGradient>
<radialGradient id='win'><stop offset='0' stop-color='#fff1b8'/><stop offset='1' stop-color='#ffc865'/></radialGradient>
<radialGradient id='halo'><stop offset='0' stop-color='rgba(255,210,120,.5)'/><stop offset='1' stop-color='rgba(255,210,120,0)'/></radialGradient></defs>
<g transform='translate(76 34)'>${smoke(0)}${smoke(-1.2)}${smoke(-2.4)}</g>
<rect x='70' y='34' width='11' height='22' fill='#4b3650'/>
<ellipse cx='60' cy='112' rx='60' ry='6' fill='rgba(120,170,130,.35)'/>
<circle cx='36' cy='86' r='20' fill='url(#halo)'><animate attributeName='opacity' values='1;.6;1;.85;1' dur='3.2s' repeatCount='indefinite'/></circle>
<path d='M8 66 L58 28 L108 66 Z' fill='url(#roof)'/>
<rect x='18' y='64' width='80' height='46' rx='2' fill='url(#wall)'/>
<rect x='28' y='74' width='17' height='15' rx='1.5' fill='url(#win)'><animate attributeName='opacity' values='1;.75;1;.9;1' dur='3.2s' repeatCount='indefinite'/></rect>
<path d='M36.5 74 V89 M28 81.5 H45' stroke='#6a4c55' stroke-width='1'/>
<rect x='70' y='74' width='17' height='15' rx='1.5' fill='url(#win)' opacity='.85'/>
<path d='M78.5 74 V89 M70 81.5 H87' stroke='#6a4c55' stroke-width='1'/>
<rect x='50' y='86' width='14' height='24' rx='1.5' fill='#d98aac'/><circle cx='61' cy='99' r='1' fill='#fff3c4'/>
<g fill='rgba(110,170,120,.85)'><circle cx='112' cy='104' r='9'/><circle cx='122' cy='106' r='7'/><circle cx='10' cy='106' r='7'/></g>`)

// ---------- SVG: koin ----------
const coinTile = (c, seed, S, n, rMin, rMax, sparkle) => {
  const r = R(seed)
  let b = `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff4c2'/><stop offset='.45' stop-color='#f4cd57'/><stop offset='1' stop-color='#c8962c'/></linearGradient></defs>`
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin), d = 0.9 + r() * 1.3, bg = -r() * d, tilt = Math.round((r() - 0.5) * 50)
    const spin = (rx) => smil("rx", `${n1(rx)};${n1(rx * 0.12)};${n1(rx)}`, d, bg)
    b += wrap(S, S, x, y, rad + 2, (X, Y) => `<g transform='translate(${n1(X)} ${n1(Y)}) rotate(${tilt})'><ellipse rx='${n1(rad)}' ry='${n1(rad)}' fill='url(#g)' stroke='${c.coinRim}' stroke-width='.9'>${spin(rad)}</ellipse><ellipse rx='${n1(rad * 0.66)}' ry='${n1(rad * 0.66)}' fill='none' stroke='${c.coinRim}' stroke-width='.7' opacity='.7'>${spin(rad * 0.66)}</ellipse></g>`)
  }
  if (sparkle) for (let i = 0; i < 4; i++) {
    const x = n1(r() * S), y = n1(r() * S), d = 1.5 + r() * 2
    b += `<path transform='translate(${x} ${y})' d='M0 -3 L.6 -.6 L3 0 L.6 .6 L0 3 L-.6 .6 L-3 0 L-.6 -.6Z' fill='#fff6cf' opacity='0'>${smil("opacity", "0;1;0;0", d, -r() * d)}</path>`
  }
  return svg(S, S, b)
}

// ---------- SVG: pesawat ----------
const planeSvg = (c) => svg(240, 44, `<defs>
<linearGradient id='t' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='${rgba(c.trail, 0)}'/><stop offset='1' stop-color='${rgba(c.trail, c.trailA)}'/></linearGradient>
<linearGradient id='f' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${c.plane[0]}'/><stop offset='1' stop-color='${c.plane[1]}'/></linearGradient></defs>
<path d='M0 19 H150' stroke='url(#t)' stroke-width='2.2' stroke-linecap='round'/><path d='M20 25 H152' stroke='url(#t)' stroke-width='1.6' stroke-linecap='round'/>
<g stroke='${c.planeLine}' stroke-width='.7'>
<path d='M168 21 L196 4 H204 L188 21Z' fill='url(#f)'/>
<path d='M150 22 L148 8 H155 L166 21Z' fill='url(#f)'/>
<path d='M150 20 Q152 17 160 17 H222 Q234 17 238 21 Q234 25 222 25 H160 Q152 25 150 22Z' fill='url(#f)'/>
<path d='M170 23 L198 36 H206 L190 23Z' fill='url(#f)'/>
</g>
<g fill='#6f87b0'>${[170, 176, 182, 188, 194, 200, 206, 212].map((x) => `<rect x='${x}' y='19.2' width='2.6' height='2' rx='.8'/>`).join("")}<path d='M226 19 Q232 19 234 21 H226Z'/></g>`)

// ---------- Tema ----------
const T = (c) => {
  const slant = 0.125
  return {
    rain: {
      b: { dur: 5, layers: [
        { img: rainTile(c, 11, 100, 100, 9, 9, 0.8, c.rainA * 0.45, slant), w: 100, h: 100, pts: path(-100, 800) },
        { img: rainTile(c, 23, 150, 150, 8, 15, 1.1, c.rainA * 0.75, slant), w: 150, h: 150, pts: path(-150, 1200) },
      ] },
      a: { dur: 2.5, layers: [
        { img: rainTile(c, 37, 180, 180, 5, 24, 1.5, c.rainA, slant), w: 180, h: 180, pts: path(-180, 1440) },
        { img: splashTile(c), w: 260, h: 32, bottom: 0, repeat: "repeat-x" },
      ] },
    },
    water: {
      b: { dur: 24, layers: [
        { img: waveTile(c.wave[2], c.waveA[2], 400, 44, 4, 2, 0, rgba(c.crest, 0.55)), w: 400, h: 44, bottom: 0, repeat: "repeat-x", pts: path(-800, 0) },
        { img: waveTile(c.wave[1], c.waveA[1], 300, 58, 5, 1, 1.3, rgba(c.crest, 0.3)), w: 300, h: 58, bottom: 0, repeat: "repeat-x", pts: path(300, 0) },
        { img: waveTile(c.wave[0], c.waveA[0], 500, 74, 6, 2, 2.4), w: 500, h: 74, bottom: 0, repeat: "repeat-x", pts: path(-500, 0) },
      ] },
      a: { dur: 0, layers: [{ img: glintTile(c), w: 240, h: 64, bottom: 0, repeat: "repeat-x" }] },
    },
    bubbles: {
      b: { dur: 16, layers: [{ img: bubbleTile(c, 5, 160, 9, 2, 5), w: 160, h: 160, pts: path(0, -160, 6, 2) }] },
      a: { dur: 13, layers: [{ img: bubbleTile(c, 17, 240, 5, 6, 13), w: 240, h: 240, pts: path(0, -480, 10, 2) }] },
    },
    snow: {
      b: { dur: 14, timing: "linear", layers: [
        { img: snowTile(c, 3, 120, 24, 0.7, 1.3), w: 120, h: 120, pts: path(0, 120, 8, 1) },
        { img: snowTile(c, 9, 180, 14, 1.4, 2.4), w: 180, h: 180, pts: path(0, 360, 14, 1) },
      ] },
      a: { dur: 14, layers: [{ img: snowTile(c, 21, 260, 7, 2.8, 4.2, 2), w: 260, h: 260, pts: path(0, 520, 22, 2) }] },
    },
    stars: {
      b: { dur: 0, layers: [{ img: starField(c, 41, 220), w: 220, h: 220 }] },
      a: { dur: 9, timing: "ease-in", layers: [{ img: shootingStar(c), w: 150, h: 70, repeat: "no-repeat" }],
        kf: (name) => `@keyframes ${name} { 0%, 72% { background-position: 115% -40%; opacity: 0; } 74% { opacity: 1; } 90%, 100% { background-position: -30% 140%; opacity: 0; } }` },
    },
    aurora: {
      b: { dur: 30, timing: "ease-in-out", direction: "alternate", layers: [
        { img: curtain(c.aurora[0], c.auroraA, 400, 160, 2, 0, 110, 14), w: 400, h: "100%", repeat: "repeat-x", pts: path(-400, 0) },
        { img: curtain(c.aurora[1], c.auroraA * 0.85, 300, 160, 1, 1.5, 90, 18), w: 300, h: "100%", repeat: "repeat-x", pts: path(300, 0) },
        { img: curtain(c.aurora[2], c.auroraA * 0.8, 500, 160, 2, 3, 130, 12), w: 500, h: "100%", repeat: "repeat-x", pts: path(-500, 0) },
      ] },
      a: null,
    },
    sakura: {
      b: { dur: 22, layers: [{ img: petalTile(c, 13, 200, 7, 0.55, 0.8), w: 200, h: 200, pts: path(200, 400, 16, 1) }] },
      a: { dur: 15, layers: [{ img: petalTile(c, 29, 280, 5, 0.95, 1.3), w: 280, h: 280, pts: path(280, 560, 26, 1) }] },
    },
    clouds: {
      b: { dur: 70, layers: [
        { img: cloudTile(c, 61, 420, 120, [[110, 46, 1], [320, 80, 0.75]]), w: 420, h: 120, y: 0, repeat: "repeat-x", pts: path(-840, 0) },
        { img: cloudTile(c, 67, 300, 120, [[80, 30, 0.55], [230, 70, 0.45]], 0.7), w: 300, h: 120, y: 10, repeat: "repeat-x", pts: path(-300, 0) },
      ] },
      a: null,
    },
    school: {
      b: { dur: 90, layers: [
        { img: schoolTile(c), w: 240, h: 240, pts: path(-240, 0) },
        { img: svg(60, 10, `<rect x='34' width='1.2' height='10' fill='${rgba(c.margin, c.marginA)}'/>`), w: 60, h: 10, repeat: "repeat-y" },
        { img: svg(12, 24, `<rect y='23' width='12' height='.8' fill='${rgba(c.ruled, c.ruledA)}'/>`), w: 12, h: 24 },
      ] },
      a: null,
    },
    car: {
      b: { dur: 16, layers: [
        { img: dashTile(c), w: 50, h: 4, bottom: 13, repeat: "repeat-x", pts: path(-4000, 0) },
        { img: roadTile(c), w: 400, h: 30, bottom: 0, repeat: "repeat-x" },
        { img: treeTile(c), w: 320, h: 56, bottom: 27, repeat: "repeat-x", pts: path(-2560, 0) },
        { img: hillTile(c), w: 420, h: 60, bottom: 26, repeat: "repeat-x", pts: path(-840, 0) },
        { img: mountainTile(c), w: 600, h: 100, bottom: 28, repeat: "repeat-x", pts: path(-600, 0) },
      ] },
      a: { dur: 0.32, timing: "ease-in-out", direction: "alternate", layers: [{ img: carSvg, w: 110, h: 48, x: "24%", bottom: 6, repeat: "no-repeat", pts: [[0, 0], [0, -1]] }], stops: [0, 100] },
    },
    house: {
      b: { dur: 0, layers: [
        { img: fireflyTile(c), w: 200, h: 160 },
        { img: moonSvg(c), w: 56, h: 56, x: "10%", y: 6, repeat: "no-repeat" },
        { img: starField(c, 77, 200), w: 200, h: 200 },
      ] },
      a: { dur: 0, layers: [{ img: houseSvg, w: 130, h: 118, x: "calc(100% - 4px)", bottom: -4, repeat: "no-repeat" }] },
    },
    money: {
      b: { dur: 9, layers: [{ img: coinTile(c, 31, 180, 9, 4, 6, true), w: 180, h: 180, pts: path(0, 360, 6, 1) }] },
      a: { dur: 7, layers: [{ img: coinTile(c, 47, 260, 6, 8, 11, false), w: 260, h: 260, pts: path(0, 520, 10, 1) }] },
    },
    plane: {
      b: { dur: 50, layers: [
        { img: cloudTile(c, 71, 420, 120, [[120, 90, 0.9], [330, 60, 0.7]]), w: 420, h: 120, y: 10, repeat: "repeat-x", pts: path(-1260, 0) },
        { img: cloudTile(c, 73, 300, 120, [[90, 30, 0.5], [240, 56, 0.4]], 0.65), w: 300, h: 120, y: 0, repeat: "repeat-x", pts: path(-300, 0) },
      ] },
      a: { dur: 16, layers: [{ img: planeSvg(c), w: 240, h: 44, repeat: "no-repeat" }],
        kf: (name) => `@keyframes ${name} { 0% { background-position: -260px 34%; } 50% { background-position: 50% 24%; } 100% { background-position: calc(100% + 260px) 30%; } }` },
    },
  }
}

// ---------- CSS ----------
const len = (v) => (typeof v === "number" ? `${v}px` : v)
const posAt = (L, [dx, dy]) => {
  const x = typeof L.x === "string" ? L.x : `${n1((L.x ?? 0) + dx)}px`
  const y = L.bottom != null ? `calc(100% + ${n1(dy - L.bottom)}px)` : typeof L.y === "string" ? L.y : `${n1((L.y ?? 0) + dy)}px`
  return `${x} ${y}`
}
const stopsOf = (P) => P.stops ?? Array.from({ length: N + 1 }, (_, i) => n1((100 * i) / N))
const ptsAt = (L, i) => (L.pts ?? STILL)[i] ?? [0, 0]

function pseudoVars(prefix, P, name) {
  const L = P.layers
  // Hemat baterai: animasi panjang dijalankan bertahap ~FPS frame/detik (steps), bukan 60–120 fps.
  // Timing function berlaku per segmen keyframe, jadi jumlah step dibagi jumlah segmen.
  const segs = P.kf ? 3 : stopsOf(P).length - 1
  const timing = P.dur >= 1 ? `steps(${Math.max(1, Math.round((P.dur * FPS) / segs))})` : (P.timing ?? "linear")
  const anim = P.dur ? `${name} ${P.dur}s ${timing} infinite${P.direction ? ` ${P.direction}` : ""}` : "none"
  return [
    `--${prefix}-bg: ${L.map((l) => l.img).join(", ")}`,
    `--${prefix}-size: ${L.map((l) => `${len(l.w)} ${len(l.h)}`).join(", ")}`,
    `--${prefix}-pos: ${L.map((l) => posAt(l, [0, 0])).join(", ")}`,
    `--${prefix}-repeat: ${L.map((l) => l.repeat ?? "repeat").join(", ")}`,
    `--${prefix}-anim: ${anim}`,
  ]
}
function keyframes(P, name, withTint) {
  if (!P.dur) return ""
  if (P.kf) return P.kf(name)
  const frames = stopsOf(P).map((s, i) => `  ${s}% { background-position: ${P.layers.map((l) => posAt(l, ptsAt(l, i))).join(", ")}${withTint ? ", 0 0" : ""}; }`)
  return `@keyframes ${name} {\n${frames.join("\n")}\n}`
}
function themeVars(key, t, tint) {
  const vars = [`--t-tint: ${tint}`, `--tb-blur: ${t.blur ?? "0px"}`]
  vars.push(...(t.b ? pseudoVars("tb", t.b, `mt-${key}-b`) : ["--tb-bg: none", "--tb-anim: none"]))
  vars.push(...(t.a ? pseudoVars("ta", t.a, `mt-${key}-a`) : ["--ta-bg: none", "--ta-anim: none"]))
  return vars
}

const themed = `.page-wrap[data-card-theme]:not([data-card-theme="none"]) .glass-panel, .page-wrap .glass-panel[data-card-theme]:not([data-card-theme="none"])`
const sel = (p) => themed.split(", ").map((s) => `${s}${p}`).join(", ")
// Partikel bergerak hanya di kartu "unggulan" yang sedang terlihat di layar (data-offscreen dipasang
// oleh components/theme-motion-guard.tsx). Kartu lain (daftar, banner, pengaturan, dialog) cukup tint statis.
// Semua kartu yang bergerak = repaint tiap frame → HP cepat panas.
const FEATURED = ".stat-card, .target-panel, .goal-card, .next-prayer, .fasting-card, .empty-state"
const live = (p) => themed.split(", ").map((s) => `${s}:is(${FEATURED}):not([data-offscreen])${p}`).join(", ")
let css = `/* AUTO-GENERATED oleh scripts/build-themes.mjs — jangan edit manual. */

${themed} { position: relative; isolation: isolate; overflow: hidden; }
${sel("::before")} {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
  background-image: var(--t-tint, none); background-size: 100% 100%; background-repeat: no-repeat;
}
${live("::after")} {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
}
${live("::before")} {
  background-image: var(--tb-bg, none), var(--t-tint, none);
  background-size: var(--tb-size, auto), 100% 100%;
  background-position: var(--tb-pos, 0 0), 0 0;
  background-repeat: var(--tb-repeat, repeat), no-repeat;
  animation: var(--tb-anim, none);
}
${live("::after")} {
  background-image: var(--ta-bg, none);
  background-size: var(--ta-size, auto);
  background-position: var(--ta-pos, 0 0);
  background-repeat: var(--ta-repeat, repeat);
  animation: var(--ta-anim, none);
}
[data-card-theme="none"] { --tb-bg: none; --ta-bg: none; --t-tint: none; --tb-anim: none; --ta-anim: none; }
`
const dark = T(PAL.dark)
const light = T(PAL.light)
for (const key of Object.keys(dark)) {
  css += `\n[data-card-theme="${key}"] {\n  ${themeVars(key, dark[key], PAL.dark.tints[key]).join(";\n  ")};\n}\n`
  css += `.app-shell[data-theme="light"] [data-card-theme="${key}"] {\n  ${themeVars(key, light[key], PAL.light.tints[key]).join(";\n  ")};\n}\n`
  const kb = dark[key].b && keyframes(dark[key].b, `mt-${key}-b`, true)
  const ka = dark[key].a && keyframes(dark[key].a, `mt-${key}-a`, false)
  css += [kb, ka].filter(Boolean).join("\n") + "\n"
}
css += `
/* Pratinjau kecil di pemilih tema */
.theme-swatch { position: relative; isolation: isolate; overflow: hidden; }
.theme-swatch::before, .theme-swatch::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.theme-swatch::before { background-image: var(--tb-bg, none), var(--t-tint, none); background-size: var(--tb-size, auto), 100% 100%; background-position: var(--tb-pos, 0 0), 0 0; background-repeat: var(--tb-repeat, repeat), no-repeat; animation: var(--tb-anim, none); }
.theme-swatch::after { background-image: var(--ta-bg, none); background-size: var(--ta-size, auto); background-position: var(--ta-pos, 0 0); background-repeat: var(--ta-repeat, repeat); animation: var(--ta-anim, none); }

@media (prefers-reduced-motion: reduce) {
  .page-wrap .glass-panel::before, .page-wrap .glass-panel::after, .theme-swatch::before, .theme-swatch::after { animation: none !important; }
}
`
writeFileSync(new URL("../app/themes.css", import.meta.url), css)
console.log(`✔ app/themes.css (${(css.length / 1024).toFixed(1)} KB, ${Object.keys(dark).length} tema × 2 palet)`)
