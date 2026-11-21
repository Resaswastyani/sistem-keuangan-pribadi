import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "mellow — keuangan & ritme harian",
    short_name: "mellow",
    description: "Kelola keuangan, jadwal, target, dan pengingat dalam satu ruang pribadi.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17121a",
    theme_color: "#17121a",
    lang: "id",
    categories: ["finance", "productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Catat transaksi", url: "/?action=transaction", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Pengingat", url: "/?tab=Pengingat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
