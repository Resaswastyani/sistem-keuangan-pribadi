import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './ibadah.css'
import './themes.css'
import './extras.css'
import { PickerOnClick } from '@/components/picker-on-click'

export const metadata: Metadata = {
  title: 'mellow — ruang kecil untuk hidup lebih teratur',
  description: 'Kelola keuangan, rutinitas, dan target harian dalam satu ruang pribadi yang menenangkan.',
  applicationName: 'mellow',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'mellow',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#17121a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className="antialiased">
        <PickerOnClick />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
