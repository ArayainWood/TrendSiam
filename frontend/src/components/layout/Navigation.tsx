'use client'

import { useState, useEffect } from 'react'
import { Menu, X, Sun, Moon, Globe, Settings } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useNewsStore } from '../../stores/newsStore'

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { 
    theme, 
    language, 
    developerMode,
    setTheme, 
    setLanguage, 
    toggleDeveloperMode
  } = useUIStore()
  const { lastUpdated } = useNewsStore()

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleTheme = () => {
    const newMode: 'light' | 'dark' = theme.mode === 'dark' ? 'light' : 'dark'
    const newTheme = { ...theme, mode: newMode }
    setTheme(newTheme)
  }

  const toggleLanguage = () => {
    const newLangCode: 'th' | 'en' = language.code === 'th' ? 'en' : 'th'
    const newLanguage = { ...language, code: newLangCode, name: newLangCode === 'th' ? 'ไทย' : 'English', flag: newLangCode === 'th' ? '🇹🇭' : '🇺🇸' }
    setLanguage(newLanguage)
  }

  const navItems = [
    { label: 'Home', href: '/', key: 'home' },
    { label: 'Weekly Report', href: '/weekly-report', key: 'report' },
    { label: 'Legal', href: '/legal', key: 'legal' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/80 dark:bg-void-950/80 backdrop-blur-xl border-b border-concrete-200/50 dark:border-void-800/50' 
        : 'bg-transparent'
    }`}>
      <div className="container-full">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo - BIG.dk inspired bold typography */}
          <div className="flex items-center">
            <a href="/" className="group">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl md:text-3xl font-heading font-bold text-concrete-900 dark:text-white transition-colors group-hover:text-accent-500">
                  Trend
                </span>
                <span className="text-2xl md:text-3xl font-heading font-bold text-accent-500">
                  Siam
                </span>
              </div>
            </a>
            
            {/* Live indicator */}
            {lastUpdated && (
              <div className="ml-4 hidden md:flex items-center gap-2 text-xs text-concrete-500 dark:text-concrete-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-mono uppercase tracking-wide">Live</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="font-heading font-medium text-concrete-700 dark:text-concrete-300 hover:text-accent-500 dark:hover:text-accent-400 transition-colors text-sm uppercase tracking-wide"
              >
                {item.key === 'legal' 
                  ? (language.code === 'th' ? 'กฎหมาย' : 'Legal')
                  : item.key === 'report' 
                  ? (language.code === 'th' ? 'รายงาน' : 'Weekly Report')
                  : item.key === 'home'
                  ? (language.code === 'th' ? 'หน้าแรก' : 'Home')
                  : item.label
                }
              </a>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg hover:bg-concrete-100 dark:hover:bg-void-800 transition-colors"
              title={`Switch to ${language.code === 'th' ? 'English' : 'Thai'}`}
            >
              <Globe className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
              <span className="sr-only">Toggle language</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-concrete-100 dark:hover:bg-void-800 transition-colors"
              title={`Switch to ${theme.mode === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme.mode === 'dark' ? (
                <Sun className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
              ) : (
                <Moon className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
              )}
              <span className="sr-only">Toggle theme</span>
            </button>

            {/* Developer mode toggle */}
            <button
              onClick={toggleDeveloperMode}
              className={`p-2 rounded-lg transition-colors ${
                developerMode 
                  ? 'bg-accent-500 text-white' 
                  : 'hover:bg-concrete-100 dark:hover:bg-void-800'
              }`}
              title="Toggle developer mode"
            >
              <Settings className="w-5 h-5" />
              <span className="sr-only">Toggle developer mode</span>
            </button>



            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-concrete-100 dark:hover:bg-void-800 transition-colors"
            >
              {isOpen ? (
                <X className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
              ) : (
                <Menu className="w-5 h-5 text-concrete-600 dark:text-concrete-400" />
              )}
              <span className="sr-only">Toggle menu</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isOpen && (
          <div className="md:hidden border-t border-concrete-200 dark:border-void-800 bg-white dark:bg-void-950">
            <div className="py-4 space-y-2">
              {navItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className="block px-4 py-3 font-heading font-medium text-concrete-700 dark:text-concrete-300 hover:text-accent-500 dark:hover:text-accent-400 hover:bg-concrete-50 dark:hover:bg-void-900 transition-colors rounded-lg mx-2"
                  onClick={() => setIsOpen(false)}
                >
                  {item.key === 'legal' 
                    ? (language.code === 'th' ? 'กฎหมาย' : 'Legal')
                    : item.key === 'report' 
                    ? (language.code === 'th' ? 'รายงาน' : 'Weekly Report')
                    : item.key === 'home'
                    ? (language.code === 'th' ? 'หน้าแรก' : 'Home')
                    : item.label
                  }
                </a>
              ))}
              
              {/* Legal quick links */}
              <div className="px-4 pt-4 border-t border-concrete-200 dark:border-void-800">
                <div className="text-xs font-mono uppercase tracking-wide text-concrete-500 dark:text-concrete-500 mb-3">
                  Legal Pages
                </div>
                <div className="space-y-2 mb-4">
                  <a 
                    href="/privacy" 
                    className="block text-sm text-concrete-600 dark:text-concrete-400 hover:text-accent-500 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {language.code === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}
                  </a>
                  <a 
                    href="/terms" 
                    className="block text-sm text-concrete-600 dark:text-concrete-400 hover:text-accent-500 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {language.code === 'th' ? 'เงื่อนไขการใช้งาน' : 'Terms of Service'}
                  </a>
                </div>
                <div className="text-xs font-mono uppercase tracking-wide text-concrete-500 dark:text-concrete-500 mb-3">
                  Quick Actions
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      toggleLanguage()
                      setIsOpen(false)
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-concrete-100 dark:bg-void-800 text-sm font-medium text-concrete-700 dark:text-concrete-300"
                  >
                    <Globe className="w-4 h-4" />
                    {language.code === 'th' ? 'EN' : 'TH'}
                  </button>
                  <button
                    onClick={() => {
                      toggleTheme()
                      setIsOpen(false)
                    }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-concrete-100 dark:bg-void-800 text-sm font-medium text-concrete-700 dark:text-concrete-300"
                  >
                    {theme.mode === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4" />
                        Light
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4" />
                        Dark
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}