// Generator app/themes.css — tema animasi latar kartu (CSS + SVG inline, tanpa aset luar).
// Jalankan: node scripts/build-themes.mjs
// Cara kerja: [data-card-theme="x"] mengisi variabel CSS (--tb-* untuk ::before, --ta-* untuk ::after).
// Variabel diwariskan, jadi tema per-menu (di .page-wrap) bisa ditimpa tema per-kartu (mis. target).
import { writeFileSync } from "node:fs"

const svg = (w, h, body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`).replace(/'/g, "%27")}")`

// ---------- SVG ----------
const rainA = svg(120, 120, [[10, 5], [40, 60], [70, 20], [100, 80], [25, 95], [85, 40], [55, 100]].map(([x, y]) => `<line x1='${x}' y1='${y}' x2='${x - 4}' y2='${y + 16}' stroke='rgba(190,215,255,.55)' stroke-width='1.2' stroke-linecap='round'/>`).join(""))
const rainB = svg(80, 80, [[15, 10], [55, 35], [30, 60], [70, 70]].map(([x, y]) => `<line x1='${x}' y1='${y}' x2='${x - 3}' y2='${y + 10}' stroke='rgba(200,225,255,.35)' stroke-width='1' stroke-linecap='round'/>`).join(""))
const wave = (fill, h = 60) => svg(400, h, `<path d='M0 ${h * 0.45} C 50 ${h * 0.15}, 150 ${h * 0.75}, 200 ${h * 0.45} S 350 ${h * 0.15}, 400 ${h * 0.45} V ${h} H 0 Z' fill='${fill}'/>`)
const bubblesA = svg(160, 160, [[30, 40, 9], [110, 20, 5], [80, 100, 12], [140, 130, 6], [20, 140, 4]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(255,255,255,.06)' stroke='rgba(200,235,255,.5)' stroke-width='1'/><circle cx='${x - r / 3}' cy='${y - r / 3}' r='${r / 4}' fill='rgba(255,255,255,.5)'/>`).join(""))
const bubblesB = svg(100, 100, [[20, 30, 4], [70, 60, 6], [45, 90, 3]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='rgba(220,240,255,.4)' stroke-width='1'/>`).join(""))
const snowA = svg(140, 140, [[15, 20, 2.2], [70, 10, 1.6], [120, 45, 2.6], [40, 80, 1.8], [95, 100, 2.2], [130, 125, 1.4], [20, 120, 2]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(255,255,255,.85)'/>`).join(""))
const snowB = svg(90, 90, [[20, 15, 1.2], [65, 40, 1.5], [35, 75, 1]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(255,255,255,.6)'/>`).join(""))
const starsA = svg(180, 180, [[20, 30, 1.2], [90, 15, .8], [150, 50, 1.4], [60, 90, .9], [130, 120, 1.1], [30, 150, 1], [170, 165, .7], [100, 170, 1.3]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(255,250,235,.9)'/>`).join("") + `<path d='M110 70 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z' fill='rgba(255,236,200,.8)'/>`)
const shooting = svg(120, 60, `<defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='rgba(255,255,255,0)'/><stop offset='1' stop-color='rgba(255,240,220,.95)'/></linearGradient></defs><line x1='5' y1='50' x2='110' y2='8' stroke='url(%23g)' stroke-width='1.6' stroke-linecap='round'/>`)
const petal = (x, y, rot, s = 1, c = "rgba(255,183,213,.75)") => `<g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'><path d='M0 0 C 4 -6, 10 -6, 12 0 C 10 6, 4 6, 0 0 Z' fill='${c}'/></g>`
const sakuraA = svg(180, 180, [petal(20, 30, 20), petal(110, 15, -30, .8), petal(150, 90, 60, 1.1), petal(60, 110, 120, .9), petal(30, 160, -10, .7), petal(130, 150, 200, 1)].join(""))
const sakuraB = svg(120, 120, [petal(30, 20, 45, .7, "rgba(255,214,231,.6)"), petal(90, 70, -60, .6, "rgba(255,214,231,.6)"), petal(50, 100, 10, .8, "rgba(255,214,231,.6)")].join(""))
const cloud = (x, y, s, o) => `<g transform='translate(${x} ${y}) scale(${s})' fill='rgba(255,255,255,${o})'><ellipse cx='30' cy='20' rx='22' ry='13'/><ellipse cx='52' cy='14' rx='18' ry='14'/><ellipse cx='70' cy='22' rx='16' ry='10'/><rect x='12' y='20' width='70' height='12' rx='6'/></g>`
const cloudsA = svg(360, 120, cloud(10, 10, 1, .16) + cloud(200, 50, .8, .12))
const cloudsB = svg(260, 120, cloud(60, 70, .6, .1) + cloud(170, 15, .5, .08))
const ink = "rgba(255,240,215,.3)"
const schoolA = svg(220, 220, [
  // buku terbuka
  `<g transform='translate(20 30)' fill='none' stroke='${ink}' stroke-width='1.4' stroke-linejoin='round'><path d='M0 4 Q12 0 24 4 V24 Q12 20 0 24Z'/><path d='M24 4 Q36 0 48 4 V24 Q36 20 24 24Z'/></g>`,
  // pensil
  `<g transform='translate(140 30) rotate(35)' fill='none' stroke='${ink}' stroke-width='1.4'><rect x='0' y='0' width='40' height='8' rx='1.5'/><path d='M40 0 L50 4 L40 8'/><line x1='8' y1='0' x2='8' y2='8'/></g>`,
  // toga
  `<g transform='translate(90 110)' fill='none' stroke='${ink}' stroke-width='1.4' stroke-linejoin='round'><path d='M0 10 L24 0 L48 10 L24 20 Z'/><path d='M10 14 V24 Q24 32 38 24 V14'/><path d='M44 12 V26'/></g>`,
  // penggaris
  `<g transform='translate(20 150) rotate(-15)' fill='none' stroke='${ink}' stroke-width='1.3'><rect x='0' y='0' width='56' height='12' rx='2'/>${[8, 16, 24, 32, 40, 48].map((x) => `<line x1='${x}' y1='0' x2='${x}' y2='${x % 16 ? 4 : 7}'/>`).join("")}</g>`,
  // A+ dan bintang
  `<text x='165' y='175' font-family='Georgia,serif' font-size='20' font-weight='700' fill='${ink}'>A+</text>`,
  `<path d='M190 100 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z' fill='${ink}'/>`,
].join(""))
const road = svg(400, 46, `<rect y='20' width='400' height='26' fill='rgba(20,16,24,.55)'/><rect y='19' width='400' height='2' fill='rgba(255,255,255,.12)'/>`)
const dashes = svg(48, 4, `<rect width='24' height='3' rx='1.5' fill='rgba(255,236,170,.7)'/>`)
const hills = svg(420, 70, `<path d='M0 70 Q60 20 120 50 T240 40 T360 45 T420 50 V70Z' fill='rgba(170,215,180,.16)'/><g fill='rgba(170,215,180,.28)'><path d='M70 52 l8 -22 8 22z'/><path d='M300 48 l7 -18 7 18z'/><path d='M190 50 l6 -15 6 15z'/></g>`)
const car = svg(70, 34, `<g><path d='M6 22 Q6 14 14 13 L22 6 Q25 3 30 3 H44 Q49 3 52 7 L58 13 Q66 14 66 22 V26 H6Z' fill='%23f1a8c5'/><path d='M24 8 H33 V13 H19Z M36 8 H45 L50 13 H36Z' fill='rgba(255,255,255,.75)'/><circle cx='18' cy='26' r='6' fill='%23221a26'/><circle cx='18' cy='26' r='2.5' fill='%23ddd'/><circle cx='54' cy='26' r='6' fill='%23221a26'/><circle cx='54' cy='26' r='2.5' fill='%23ddd'/><rect x='62' y='17' width='4' height='3' rx='1' fill='%23ffe9a8'/></g>`)
const house = svg(120, 110, `
  <g transform='translate(10 30)'>
    <rect x='60' y='4' width='10' height='22' fill='rgba(120,90,110,.9)'/>
    <circle cx='65' cy='-2' r='4' fill='rgba(255,255,255,.35)'><animate attributeName='cy' values='-2;-26' dur='3s' repeatCount='indefinite'/><animate attributeName='r' values='3;8' dur='3s' repeatCount='indefinite'/><animate attributeName='opacity' values='.6;0' dur='3s' repeatCount='indefinite'/></circle>
    <circle cx='65' cy='-2' r='4' fill='rgba(255,255,255,.35)'><animate attributeName='cy' values='-2;-26' dur='3s' begin='1.5s' repeatCount='indefinite'/><animate attributeName='r' values='3;8' dur='3s' begin='1.5s' repeatCount='indefinite'/><animate attributeName='opacity' values='.6;0' dur='3s' begin='1.5s' repeatCount='indefinite'/></circle>
    <path d='M0 36 L48 0 L96 36 Z' fill='rgba(233,156,187,.85)'/>
    <rect x='10' y='34' width='76' height='44' rx='2' fill='rgba(70,52,72,.92)'/>
    <rect x='20' y='44' width='16' height='14' rx='1.5' fill='%23ffd98a'><animate attributeName='opacity' values='1;.65;1' dur='4s' repeatCount='indefinite'/></rect>
    <rect x='60' y='44' width='16' height='14' rx='1.5' fill='%23ffd98a' opacity='.85'/>
    <rect x='41' y='54' width='14' height='24' rx='1.5' fill='rgba(233,156,187,.7)'/>
  </g>`)
const coinsA = svg(160, 160, [[30, 30], [110, 20], [70, 95], [140, 120], [20, 135]].map(([x, y], i) => `<g transform='translate(${x} ${y}) rotate(${i * 25})'><ellipse rx='9' ry='${i % 2 ? 9 : 4}' fill='%23f3d77e'/><ellipse rx='6' ry='${i % 2 ? 6 : 2.5}' fill='none' stroke='%23c9a640' stroke-width='1'/></g>`).join(""))
const coinsB = svg(110, 110, [[25, 20], [80, 60], [40, 95]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='5' fill='rgba(243,215,126,.6)'/>`).join(""))
const plane = svg(64, 30, `<g fill='rgba(255,255,255,.9)'><path d='M2 15 L46 13 Q60 13 62 15 Q60 17 46 17 Z'/><path d='M26 14 L16 2 H22 L36 14Z'/><path d='M26 16 L16 28 H22 L36 16Z'/><path d='M8 14 L4 7 H8 L13 14Z'/></g><path d='M-40 15 H2' stroke='rgba(255,255,255,.35)' stroke-width='1.5' stroke-dasharray='4 4'/>`)

// ---------- Tema ----------
const T = {
  rain: {
    tint: "linear-gradient(180deg, rgba(120,160,230,.10), rgba(120,160,230,.02))",
    b: { bg: rainA, size: "120px 120px", anim: "mt-rain 0.55s linear infinite" },
    a: { bg: rainB, size: "80px 80px", anim: "mt-rain2 0.8s linear infinite" },
    keyframes: `@keyframes mt-rain { to { background-position: -30px 120px, 0 0; } }\n@keyframes mt-rain2 { to { background-position: -20px 80px; } }`,
  },
  water: {
    tint: "linear-gradient(180deg, transparent 40%, rgba(110,190,230,.12))",
    b: { bg: wave("rgba(130,200,240,.16)", 70), size: "400px 70px", pos: "0 100%", repeat: "repeat-x", anim: "mt-wave 7s linear infinite" },
    a: { bg: wave("rgba(170,225,250,.12)", 50), size: "300px 50px", pos: "0 100%", repeat: "repeat-x", anim: "mt-wave2 11s linear infinite" },
    keyframes: `@keyframes mt-wave { to { background-position: -400px 100%, 0 0; } }\n@keyframes mt-wave2 { to { background-position: 300px 100%; } }`,
  },
  bubbles: {
    tint: "radial-gradient(circle at 80% 100%, rgba(140,210,240,.12), transparent 60%)",
    b: { bg: bubblesA, size: "160px 160px", anim: "mt-rise 9s linear infinite" },
    a: { bg: bubblesB, size: "100px 100px", anim: "mt-rise2 6s linear infinite" },
    keyframes: `@keyframes mt-rise { to { background-position: 0 -160px, 0 0; } }\n@keyframes mt-rise2 { to { background-position: 10px -100px; } }`,
  },
  snow: {
    tint: "linear-gradient(180deg, rgba(200,220,255,.07), transparent)",
    b: { bg: snowA, size: "140px 140px", anim: "mt-snow 11s linear infinite" },
    a: { bg: snowB, size: "90px 90px", anim: "mt-snow2 7s linear infinite" },
    keyframes: `@keyframes mt-snow { to { background-position: 30px 140px, 0 0; } }\n@keyframes mt-snow2 { to { background-position: -20px 90px; } }`,
  },
  stars: {
    tint: "radial-gradient(ellipse at 70% 0%, rgba(150,120,220,.16), transparent 65%)",
    b: { bg: starsA, size: "180px 180px", anim: "mt-twinkle 3.5s ease-in-out infinite alternate" },
    a: { bg: shooting, size: "120px 60px", repeat: "no-repeat", pos: "110% -20%", anim: "mt-shoot 7s ease-in infinite" },
    keyframes: `@keyframes mt-twinkle { from { opacity: .55; } to { opacity: 1; } }\n@keyframes mt-shoot { 0%, 70% { background-position: 110% -30%; opacity: 0; } 72% { opacity: 1; } 90% { background-position: -30% 130%; opacity: 0; } 100% { background-position: -30% 130%; opacity: 0; } }`,
  },
  aurora: {
    tint: "none",
    b: { bg: "radial-gradient(ellipse 60% 40% at 20% 20%, rgba(120,230,190,.20), transparent 70%), radial-gradient(ellipse 50% 45% at 80% 30%, rgba(240,150,200,.20), transparent 70%), radial-gradient(ellipse 60% 50% at 50% 90%, rgba(150,130,240,.18), transparent 70%)", size: "200% 200%", anim: "mt-aurora 14s ease-in-out infinite alternate", blur: "8px" },
    a: null,
    keyframes: `@keyframes mt-aurora { 0% { background-position: 0% 0%; } 50% { background-position: 100% 50%; } 100% { background-position: 30% 100%; } }`,
  },
  sakura: {
    tint: "linear-gradient(160deg, rgba(255,190,215,.08), transparent 60%)",
    b: { bg: sakuraA, size: "180px 180px", anim: "mt-petal 10s linear infinite" },
    a: { bg: sakuraB, size: "120px 120px", anim: "mt-petal2 7s linear infinite" },
    keyframes: `@keyframes mt-petal { to { background-position: 90px 180px, 0 0; } }\n@keyframes mt-petal2 { to { background-position: 60px 120px; } }`,
  },
  clouds: {
    tint: "linear-gradient(180deg, rgba(160,200,255,.10), transparent 70%)",
    b: { bg: cloudsA, size: "360px 120px", repeat: "repeat-x", pos: "0 0", anim: "mt-cloud 40s linear infinite" },
    a: { bg: cloudsB, size: "260px 120px", repeat: "repeat-x", pos: "0 30%", anim: "mt-cloud2 26s linear infinite" },
    keyframes: `@keyframes mt-cloud { to { background-position: -360px 0, 0 0; } }\n@keyframes mt-cloud2 { to { background-position: -260px 30%; } }`,
  },
  school: {
    tint: "linear-gradient(180deg, rgba(90,140,110,.10), rgba(90,140,110,.03))",
    b: { bg: schoolA, size: "220px 220px", anim: "mt-drift 30s linear infinite" },
    a: null,
    keyframes: `@keyframes mt-drift { to { background-position: 220px -220px, 0 0; } }`,
  },
  car: {
    tint: "linear-gradient(180deg, rgba(150,190,255,.07), transparent 70%)",
    b: { bg: `${dashes}, ${road}, ${hills}`, size: "48px 4px, 400px 46px, 420px 70px", repeat: "repeat-x, repeat-x, repeat-x", pos: "0 calc(100% - 10px), 0 100%, 0 calc(100% - 26px)", anim: "mt-road 3s linear infinite" },
    a: { bg: car, size: "70px 34px", repeat: "no-repeat", pos: "30% calc(100% - 9px)", anim: "mt-car .35s ease-in-out infinite alternate" },
    keyframes: `@keyframes mt-road { to { background-position: -48px calc(100% - 10px), -400px 100%, -420px calc(100% - 26px), 0 0; } }\n@keyframes mt-car { to { background-position: 30% calc(100% - 10px); } }`,
  },
  house: {
    tint: "radial-gradient(ellipse at 85% 100%, rgba(255,210,140,.14), transparent 55%), linear-gradient(180deg, rgba(110,90,170,.10), transparent)",
    b: { bg: starsA, size: "180px 180px", anim: "mt-twinkle 4s ease-in-out infinite alternate" },
    a: { bg: house, size: "120px 110px", repeat: "no-repeat", pos: "calc(100% - 6px) calc(100% + 4px)", anim: "none", opacity: ".8" },
    keyframes: "",
  },
  money: {
    tint: "radial-gradient(ellipse at 50% 0%, rgba(243,215,126,.12), transparent 65%)",
    b: { bg: coinsA, size: "160px 160px", anim: "mt-coin 5s linear infinite" },
    a: { bg: coinsB, size: "110px 110px", anim: "mt-coin2 3.5s linear infinite" },
    keyframes: `@keyframes mt-coin { to { background-position: 0 160px, 0 0; } }\n@keyframes mt-coin2 { to { background-position: 0 110px; } }`,
  },
  plane: {
    tint: "linear-gradient(180deg, rgba(140,190,255,.12), transparent 75%)",
    b: { bg: cloudsA, size: "360px 120px", repeat: "repeat-x", pos: "0 10%", anim: "mt-cloud 18s linear infinite" },
    a: { bg: plane, size: "64px 30px", repeat: "no-repeat", pos: "-80px 30%", anim: "mt-plane 12s linear infinite" },
    keyframes: `@keyframes mt-plane { 0% { background-position: -80px 34%; } 50% { background-position: 50% 26%; } 100% { background-position: calc(100% + 80px) 32%; } }`,
  },
}

// ---------- CSS ----------
const themed = `.page-wrap[data-card-theme]:not([data-card-theme="none"]) .glass-panel, .page-wrap .glass-panel[data-card-theme]:not([data-card-theme="none"])`
let css = `/* AUTO-GENERATED oleh scripts/build-themes.mjs — jangan edit manual. */

${themed} { position: relative; isolation: isolate; overflow: hidden; }
${themed.split(", ").map((s) => `${s}::before`).join(", ")},
${themed.split(", ").map((s) => `${s}::after`).join(", ")} {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit;
}
${themed.split(", ").map((s) => `${s}::before`).join(", ")} {
  background-image: var(--tb-bg, none), var(--t-tint, none);
  background-size: var(--tb-size, auto), 100% 100%;
  background-position: var(--tb-pos, 0 0), 0 0;
  background-repeat: var(--tb-repeat, repeat), no-repeat;
  animation: var(--tb-anim, none);
  filter: blur(var(--tb-blur, 0));
  opacity: var(--t-opacity, 1);
}
${themed.split(", ").map((s) => `${s}::after`).join(", ")} {
  background-image: var(--ta-bg, none);
  background-size: var(--ta-size, auto);
  background-position: var(--ta-pos, 0 0);
  background-repeat: var(--ta-repeat, repeat);
  animation: var(--ta-anim, none);
  opacity: var(--ta-opacity, var(--t-opacity, 1));
}
[data-card-theme="none"] { --tb-bg: none; --ta-bg: none; --t-tint: none; --tb-anim: none; --ta-anim: none; }
.app-shell[data-theme="light"] .page-wrap { --t-opacity: .75; }
`
for (const [key, t] of Object.entries(T)) {
  const vars = [`--t-tint: ${t.tint}`]
  if (t.b) {
    vars.push(`--tb-bg: ${t.b.bg}`, `--tb-size: ${t.b.size}`, `--tb-pos: ${t.b.pos ?? "0 0"}`, `--tb-repeat: ${t.b.repeat ?? "repeat"}`, `--tb-anim: ${t.b.anim}`, `--tb-blur: ${t.b.blur ?? "0px"}`)
  } else vars.push("--tb-bg: none", "--tb-anim: none", "--tb-blur: 0px")
  if (t.a) {
    vars.push(`--ta-bg: ${t.a.bg}`, `--ta-size: ${t.a.size}`, `--ta-pos: ${t.a.pos ?? "0 0"}`, `--ta-repeat: ${t.a.repeat ?? "repeat"}`, `--ta-anim: ${t.a.anim}`, `--ta-opacity: ${t.a.opacity ?? "var(--t-opacity, 1)"}`)
  } else vars.push("--ta-bg: none", "--ta-anim: none")
  css += `\n[data-card-theme="${key}"] {\n  ${vars.join(";\n  ")};\n}\n${t.keyframes}\n`
}
css += `
/* Pratinjau kecil di pemilih tema */
.theme-swatch { position: relative; isolation: isolate; overflow: hidden; }
.theme-swatch::before, .theme-swatch::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; }
.theme-swatch::before { background-image: var(--tb-bg, none), var(--t-tint, none); background-size: var(--tb-size, auto), 100% 100%; background-position: var(--tb-pos, 0 0), 0 0; background-repeat: var(--tb-repeat, repeat), no-repeat; animation: var(--tb-anim, none); filter: blur(var(--tb-blur, 0)); }
.theme-swatch::after { background-image: var(--ta-bg, none); background-size: var(--ta-size, auto); background-position: var(--ta-pos, 0 0); background-repeat: var(--ta-repeat, repeat); animation: var(--ta-anim, none); }

@media (prefers-reduced-motion: reduce) {
  .page-wrap .glass-panel::before, .page-wrap .glass-panel::after, .theme-swatch::before, .theme-swatch::after { animation: none !important; }
}
`
writeFileSync(new URL("../app/themes.css", import.meta.url), css)
console.log(`✔ app/themes.css (${(css.length / 1024).toFixed(1)} KB, ${Object.keys(T).length} tema)`)
