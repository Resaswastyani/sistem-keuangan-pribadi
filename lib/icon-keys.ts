// Daftar ikon yang bisa dipilih (dipakai server untuk validasi dan client untuk pemilih ikon).
// Sumber ikon: lucide-react. Tambah ikon baru cukup di sini + di components/icons.tsx.

export const ICON_GROUPS: { label: string; icons: [key: string, label: string][] }[] = [
  { label: "Umum", icons: [["sparkles", "Bintang"], ["star", "Favorit"], ["heart", "Hati"], ["target", "Target"], ["flag", "Bendera"], ["rocket", "Roket"], ["crown", "Mahkota"], ["bell", "Lonceng"], ["clock", "Jam"], ["alarm", "Alarm"], ["calendar", "Kalender"], ["pin", "Lokasi"]] },
  { label: "Pendidikan & karier", icons: [["graduation", "Wisuda"], ["school", "Sekolah"], ["book", "Buku"], ["library", "Perpustakaan"], ["bookmark", "Bacaan"], ["notebook", "Catatan"], ["pencil", "Menulis"], ["brain", "Psikotes"], ["lightbulb", "Ide"], ["award", "Penghargaan"], ["trophy", "Juara"], ["medal", "Medali"], ["briefcase", "Kerja"], ["laptop", "Laptop"], ["code", "Coding"], ["handshake", "Kerja sama"]] },
  { label: "Kendaraan & perjalanan", icons: [["car", "Mobil"], ["carfront", "Mobil depan"], ["bike", "Sepeda"], ["bus", "Bus"], ["train", "Kereta"], ["plane", "Pesawat"], ["ship", "Kapal"], ["fuel", "Bensin"], ["globe", "Dunia"], ["map", "Peta"], ["mountain", "Gunung"], ["palm", "Pantai"], ["tent", "Kemah"]] },
  { label: "Rumah & properti", icons: [["home", "Rumah"], ["building", "Gedung"], ["apartment", "Apartemen"], ["hotel", "Hotel"], ["store", "Toko"], ["sofa", "Sofa"], ["bed", "Tidur"], ["armchair", "Santai"], ["key", "Kunci"], ["hammer", "Renovasi"], ["wrench", "Perbaikan"]] },
  { label: "Uang & belanja", icons: [["wallet", "Dompet"], ["piggy", "Celengan"], ["coins", "Koin"], ["banknote", "Uang"], ["handcoins", "Investasi"], ["landmark", "Bank"], ["card", "Kartu"], ["gem", "Perhiasan"], ["gift", "Hadiah"], ["bag", "Belanja"], ["shirt", "Baju"], ["watch", "Jam tangan"], ["scale", "Seimbang"]] },
  { label: "Gadget & hobi", icons: [["smartphone", "HP"], ["headphones", "Headphone"], ["camera", "Kamera"], ["tv", "TV"], ["monitor", "Monitor"], ["gamepad", "Game"], ["music", "Musik"], ["piano", "Piano"], ["guitar", "Gitar"], ["mic", "Nyanyi"], ["film", "Film"], ["palette", "Seni"]] },
  { label: "Kesehatan & olahraga", icons: [["dumbbell", "Gym"], ["activity", "Kardio"], ["footprints", "Jogging"], ["stethoscope", "Dokter"], ["pill", "Obat"], ["apple", "Sehat"], ["salad", "Diet"], ["coffee", "Kopi"], ["utensils", "Makan"], ["pizza", "Kuliner"]] },
  { label: "Keluarga & alam", icons: [["baby", "Bayi"], ["users", "Keluarga"], ["love", "Pernikahan"], ["paw", "Hewan"], ["cat", "Kucing"], ["dog", "Anjing"], ["sprout", "Tumbuh"], ["flower", "Bunga"], ["leaf", "Daun"], ["tree", "Pohon"], ["droplets", "Air"], ["umbrella", "Hujan"], ["snowflake", "Salju"], ["sun", "Matahari"], ["moon", "Bulan"], ["flame", "Semangat"], ["zap", "Energi"], ["church", "Ibadah"]] },
]

export const ICON_KEYS = ICON_GROUPS.flatMap((g) => g.icons.map(([k]) => k)) as [string, ...string[]]
export const ICON_LABEL: Record<string, string> = Object.fromEntries(ICON_GROUPS.flatMap((g) => g.icons))
