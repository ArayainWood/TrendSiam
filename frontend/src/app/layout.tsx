import './globals.css'
import type { Metadata } from 'next'
import { Providers } from '../components/providers'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'TrendSiam - Thai Daily News Summary',
  description: 'AI-powered Thai trending news aggregation platform with comprehensive auto-classification and bilingual summaries.',
  keywords: ['Thai news', 'trending', 'AI summaries', 'YouTube', 'Thailand'],
  authors: [{ name: 'TrendSiam Team' }],
  openGraph: {
    title: 'TrendSiam - Thai Daily News Summary',
    description: 'AI-powered Thai trending news aggregation platform',
    type: 'website',
    locale: 'th_TH',
    alternateLocale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrendSiam - Thai Daily News Summary',
    description: 'AI-powered Thai trending news aggregation platform',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-concrete-50 to-concrete-100 dark:from-void-950 dark:to-void-900 transition-colors duration-300">
            {children}
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'bg-white dark:bg-void-800 text-concrete-900 dark:text-concrete-100',
              style: {
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'rgb(226 232 240 / 1)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}