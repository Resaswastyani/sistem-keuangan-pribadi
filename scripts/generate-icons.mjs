// Membuat semua ikon PNG dari public/icon.svg. Jalankan: pnpm icons
import sharp from "sharp"
import { mkdirSync, readFileSync } from "node:fs"

const svg = readFileSync("public/icon.svg", "utf8")
mkdirSync("public/icons", { recursive: true })

// Versi full-bleed (tanpa sudut membulat) untuk iOS & maskable Android — OS yang memotong bentuknya.
const fullBleed = svg.replace('rx="116"', 'rx="0"')
// Maskable: konten diperkecil agar tetap di dalam "safe zone" 80%.
const maskable = fullBleed.replace(/(<rect width="512"[^>]*\/>)([\s\S]*)(<\/svg>)/, (_, bg, rest, end) => `${bg}<g transform="translate(256 256) scale(.78) translate(-256 -256)">${rest}</g>${end}`)
// Badge Android (status bar): siluet putih di atas transparan.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 40 C272 190 322 240 472 256 C322 272 272 322 256 472 C240 322 190 272 40 256 C190 240 240 190 256 40 Z" fill="#fff"/></svg>`

const out = [
  [svg, 192, "public/icons/icon-192.png"],
  [svg, 512, "public/icons/icon-512.png"],
  [maskable, 192, "public/icons/maskable-192.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [fullBleed, 180, "public/apple-icon.png"],
  [badge, 96, "public/icons/badge-96.png"],
  [svg, 32, "public/icon-light-32x32.png"],
  [svg, 32, "public/icon-dark-32x32.png"],
]

for (const [source, size, file] of out) {
  await sharp(Buffer.from(source), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log("✔", file)
}
