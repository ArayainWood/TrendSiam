'use client'

import { useState, useMemo } from 'react'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { useNewsStore } from '../../stores/newsStore'
import { useUIStore } from '../../stores/uiStore'
import { FilterState } from '../../types'

export function FilterPanel() {
  const { news, filterNews } = useNewsStore()
  const { language } = useUIStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    platform: 'all',
    category: 'all',
    date: 'all',
    searchQuery: ''
  })

  // Extract unique categories and platforms
  const categories = useMemo(() => {
    const cats = Array.from(new Set(news.map(item => item.auto_category))).filter(Boolean)
    return cats.sort()
  }, [news])

  const platforms = useMemo(() => {
    const plats = Array.from(new Set(news.map(item => item.channel))).filter(Boolean)
    return plats.sort().slice(0, 10) // Limit to top 10 channels
  }, [news])

  const updateFilter = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    filterNews(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      platform: 'all',
      category: 'all', 
      date: 'all',
      searchQuery: ''
    }
    setFilters(clearedFilters)
    filterNews(clearedFilters)
  }

  const hasActiveFilters = filters.platform !== 'all' || 
                          filters.category !== 'all' || 
                          filters.date !== 'all' || 
                          filters.searchQuery !== ''

  return (
    <div className="bg-white dark:bg-void-900 border-b border-concrete-200 dark:border-void-800">
      <div className="container-full">
        <div className="py-6">
          {/* Search bar - always visible */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-concrete-400 dark:text-concrete-600" />
            <input
              type="text"
              placeholder={language.code === 'th' ? 'ค้นหาข่าว...' : 'Search stories...'}
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-concrete-50 dark:bg-void-800 border border-concrete-200 dark:border-void-700 rounded-lg text-concrete-900 dark:text-white placeholder-concrete-500 dark:placeholder-concrete-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300"
            />
          </div>

          {/* Filter toggle button */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-3 py-2 font-heading font-medium text-concrete-700 dark:text-concrete-300 hover:text-accent-500 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span className="text-sm uppercase tracking-wide">
                {language.code === 'th' ? 'ตัวกรอง' : 'Filters'}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-3 py-1 text-xs font-mono uppercase tracking-wide text-concrete-500 dark:text-concrete-500 hover:text-accent-500 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Expandable filters */}
          <div className={`grid gap-6 transition-all duration-500 overflow-hidden ${
            isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}>
            <div className="min-h-0">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-3">
                    {language.code === 'th' ? 'หมวดหมู่' : 'Category'}
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => updateFilter('category', e.target.value)}
                    className="w-full px-4 py-3 bg-concrete-50 dark:bg-void-800 border border-concrete-200 dark:border-void-700 rounded-lg text-concrete-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="all">
                      {language.code === 'th' ? 'ทั้งหมด' : 'All Categories'}
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Platform Filter */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-3">
                    {language.code === 'th' ? 'แหล่งข่าว' : 'Channel'}
                  </label>
                  <select
                    value={filters.platform}
                    onChange={(e) => updateFilter('platform', e.target.value)}
                    className="w-full px-4 py-3 bg-concrete-50 dark:bg-void-800 border border-concrete-200 dark:border-void-700 rounded-lg text-concrete-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="all">
                      {language.code === 'th' ? 'ทั้งหมด' : 'All Channels'}
                    </option>
                    {platforms.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-3">
                    {language.code === 'th' ? 'ช่วงเวลา' : 'Time Period'}
                  </label>
                  <select
                    value={filters.date}
                    onChange={(e) => updateFilter('date', e.target.value)}
                    className="w-full px-4 py-3 bg-concrete-50 dark:bg-void-800 border border-concrete-200 dark:border-void-700 rounded-lg text-concrete-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="all">
                      {language.code === 'th' ? 'ทั้งหมด' : 'All Time'}
                    </option>
                    <option value="today">
                      {language.code === 'th' ? 'วันนี้' : 'Today'}
                    </option>
                    <option value="yesterday">
                      {language.code === 'th' ? 'เมื่อวาน' : 'Yesterday'}
                    </option>
                    <option value="week">
                      {language.code === 'th' ? '7 วันที่ผ่านมา' : 'Past Week'}
                    </option>
                    <option value="month">
                      {language.code === 'th' ? '30 วันที่ผ่านมา' : 'Past Month'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Active filters display */}
              {hasActiveFilters && (
                <div className="mt-6 pt-6 border-t border-concrete-200 dark:border-void-800">
                  <div className="text-sm font-mono uppercase tracking-wide text-concrete-600 dark:text-concrete-400 mb-3">
                    Active Filters
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filters.category !== 'all' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded-full text-sm">
                        {filters.category}
                        <button 
                          onClick={() => updateFilter('category', 'all')}
                          className="hover:text-accent-900 dark:hover:text-accent-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {filters.platform !== 'all' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-thai-100 dark:bg-thai-900/30 text-thai-700 dark:text-thai-300 rounded-full text-sm">
                        {filters.platform}
                        <button 
                          onClick={() => updateFilter('platform', 'all')}
                          className="hover:text-thai-900 dark:hover:text-thai-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {filters.date !== 'all' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-concrete-200 dark:bg-void-700 text-concrete-700 dark:text-concrete-300 rounded-full text-sm">
                        {filters.date}
                        <button 
                          onClick={() => updateFilter('date', 'all')}
                          className="hover:text-concrete-900 dark:hover:text-concrete-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {filters.searchQuery && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-concrete-200 dark:bg-void-700 text-concrete-700 dark:text-concrete-300 rounded-full text-sm">
                        "{filters.searchQuery}"
                        <button 
                          onClick={() => updateFilter('searchQuery', '')}
                          className="hover:text-concrete-900 dark:hover:text-concrete-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}