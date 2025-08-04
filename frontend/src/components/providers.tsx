'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Prevent hydration mismatch by ensuring theme is set
    const theme = localStorage.getItem('theme') || 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
    </ThemeProvider>
  )
}