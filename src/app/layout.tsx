import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Split',
  description: 'Split shared expenses with friends. No accounts, just a shareable link.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  )
}
