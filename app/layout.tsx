import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import './kosmos-tokens.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Kmart Kurator',
  description: 'Find the perfect outfit, home look, kitchen set or party pack — powered by Kmart.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="kosmos">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
      </head>
      <body className={dmSans.variable}>{children}</body>
    </html>
  )
}
