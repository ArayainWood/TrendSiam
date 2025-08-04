'use client'

import { useEffect } from 'react'
import { Navigation } from './Navigation'
import { Footer } from './Footer'
import { FilterPanel } from '../filters/FilterPanel'
import { useUIStore } from '../../stores/uiStore'

interface LayoutProps {
  children: React.ReactNode
  showFilters?: boolean
}

export function Layout({ children, showFilters = true }: LayoutProps) {
  const { theme } = useUIStore()

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme.mode === 'dark')
  }, [theme.mode])

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-void-950">
      {/* Navigation */}
      <Navigation />
      
      {/* Main content container */}
      <main className="flex-1 relative">
        {/* Add top padding to account for fixed navigation */}
        <div className="pt-16 md:pt-20">
          {/* Filter panel - only show on main pages */}
          {showFilters && <FilterPanel />}
          
          {/* Page content */}
          <div className="min-h-full">
            {children}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  )
}