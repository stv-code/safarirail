import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SafariRail | SGR Booking Assistance for Tourists in Kenya',
  description: 'Hassle-free Madaraka Express SGR ticket booking assistance for tourists visiting Kenya. No M-Pesa? No problem. Economy, First Class & Premium.',
  keywords: 'SGR Kenya, Madaraka Express, train booking Kenya, safari rail, Nairobi Mombasa train',
  openGraph: {
    title: 'SafariRail | SGR Booking for Tourists',
    description: 'Hassle-free Madaraka Express ticket booking. We help tourists book Kenya SGR tickets — no local payment method required.',
    url: 'https://safarirail.co.ke',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
