import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UIState, FilterState, LanguageConfig, ThemeConfig } from '../types'

interface UIStore extends UIState {
  // Actions
  setDeveloperMode: (enabled: boolean) => void
  toggleDeveloperMode: () => void
  setCurrentPage: (page: UIState['currentPage']) => void
  setFilters: (filters: Partial<FilterState>) => void
  clearFilters: () => void
  setLanguage: (language: LanguageConfig) => void
  toggleLanguage: () => void
  setTheme: (theme: ThemeConfig) => void
  toggleTheme: () => void
}

const defaultFilters: FilterState = {
  platform: 'all',
  category: 'all',
  date: 'all',
  searchQuery: '',
}

const languages: LanguageConfig[] = [
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
]

const themes: Record<'light' | 'dark', ThemeConfig> = {
  light: {
    mode: 'light',
    primaryColor: '#0f172a',
    accentColor: '#ef4444',
  },
  dark: {
    mode: 'dark',
    primaryColor: '#f8fafc',
    accentColor: '#ef4444',
  },
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      developerMode: false,
      currentPage: 'main',
      filters: defaultFilters,
      language: languages[0], // Default to Thai
      theme: themes.dark, // Default to dark theme

      // Developer mode actions
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
      toggleDeveloperMode: () => set((state) => ({ developerMode: !state.developerMode })),

      // Page navigation
      setCurrentPage: (page) => set({ currentPage: page }),

      // Filter actions
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),
      clearFilters: () => set({ filters: defaultFilters }),

      // Language actions
      setLanguage: (language) => set({ language }),
      toggleLanguage: () => {
        const { language } = get()
        const currentIndex = languages.findIndex(lang => lang.code === language.code)
        const nextIndex = (currentIndex + 1) % languages.length
        set({ language: languages[nextIndex] })
      },

      // Theme actions
      setTheme: (theme) => {
        set({ theme })
        // Update document class for theme
        document.documentElement.classList.toggle('dark', theme.mode === 'dark')
      },
      toggleTheme: () => {
        const { theme } = get()
        const newTheme = themes[theme.mode === 'dark' ? 'light' : 'dark']
        get().setTheme(newTheme)
      },
    }),
    {
      name: 'trendsiam-ui-store',
      partialize: (state) => ({
        developerMode: state.developerMode,
        language: state.language,
        theme: state.theme,
        filters: state.filters,
      }),
    }
  )
)