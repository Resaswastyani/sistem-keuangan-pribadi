// Membuat semua ikon PNG dari public/icon.svg. Jalankan: pnpm icons
import sharp from "sharp"
import { mkdirSync, readFileSync } from "node:fs"

const svg = readFileSync("public/icon.svg", "utf8")
// Ikon iPhone (Tambah ke Layar Utama) memakai varian terang dominan pink.
const appleSvg = readFileSync("public/icon-apple.svg", "utf8")
mkdirSync("public/icons", { recursive: true })

// Versi full-bleed (tanpa sudut membulat) untuk iOS & maskable Android — OS yang memotong bentuknya.
const fullBleed = svg.replaceAll('rx="116"', 'rx="0"')
// Maskable: konten diperkecil agar tetap di dalam "safe zone" 80%.
const maskable = fullBleed.replace(/(<path[\s\S]*)(<\/svg>)/, (_, mark, end) => `<g transform="translate(256 256) scale(.78) translate(-256 -256)">${mark}</g>${end}`)
// Badge Android (status bar): siluet putih di atas transparan.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M120 376 V222 a68 68 0 0 1 136 0 V376 M256 222 a68 68 0 0 1 136 0 V310" fill="none" stroke="#fff" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/><circle cx="430" cy="118" r="34" fill="#fff"/></svg>`

const out = [
  [svg, 192, "public/icons/icon-192.png"],
  [svg, 512, "public/icons/icon-512.png"],
  [maskable, 192, "public/icons/maskable-192.png"],
  [maskable, 512, "public/icons/maskable-512.png"],
  [appleSvg, 180, "public/apple-icon.png"],
  [badge, 96, "public/icons/badge-96.png"],
  [svg, 32, "public/icon-light-32x32.png"],
  [svg, 32, "public/icon-dark-32x32.png"],
]

for (const [source, size, file] of out) {
  await sharp(Buffer.from(source), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  console.log("✔", file)
}
