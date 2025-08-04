'use client'

import { useNewsStore } from '../../stores/newsStore'
import { useUIStore } from '../../stores/uiStore'
import { getText } from '../../lib/i18n'
import { BarChart3, Eye, Star, TrendingUp } from 'lucide-react'

export function StatsOverview() {
  const { filteredNews, loading } = useNewsStore()
  const { language } = useUIStore()

  if (loading || filteredNews.length === 0) {
    return null
  }

  // Calculate statistics
  const totalNews = filteredNews.length
  const avgPopularity = filteredNews.reduce((sum, item) => sum + (item.popularity_score_precise || item.popularity_score), 0) / totalNews
  const totalViews = filteredNews.reduce((sum, item) => {
    const views = parseInt(item.view_count.replace(/,/g, '')) || 0
    return sum + views
  }, 0)
  const topCategories = Object.entries(
    filteredNews.reduce((acc, item) => {
      const category = item.auto_category
      acc[category] = (acc[category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  const stats = [
    {
      label: getText('total_stories', language.code),
      value: totalNews.toLocaleString(),
      icon: BarChart3,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: getText('avg_views', language.code),
      value: formatNumber(Math.round(totalViews / totalNews)),
      icon: Eye,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      label: getText('top_score', language.code),
      value: `${avgPopularity.toFixed(1)}/100`,
      icon: Star,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      label: getText('categories_count', language.code),
      value: new Set(filteredNews.map(item => item.auto_category)).size.toString(),
      icon: TrendingUp,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ]

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="news-card p-6 text-center animate-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mx-auto mb-3`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div className="text-2xl font-bold text-concrete-900 dark:text-white mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-concrete-600 dark:text-concrete-400">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Top Categories */}
      <div className="news-card p-6">
        <h3 className="text-lg font-semibold text-concrete-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent-500" />
          Top Categories
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topCategories.map(([category, count], index) => (
            <div
              key={category}
              className="flex items-center justify-between p-4 bg-concrete-50 dark:bg-void-800 rounded-lg"
            >
              <div>
                <div className="font-medium text-concrete-900 dark:text-white">
                  {getText(category, language.code)}
                </div>
                <div className="text-sm text-concrete-600 dark:text-concrete-400">
                  {count} {count === 1 ? 'story' : 'stories'}
                </div>
              </div>
              <div className={`text-xl font-bold ${
                index === 0 ? 'text-accent-500' : 
                index === 1 ? 'text-thai-500' : 
                'text-concrete-500'
              }`}>
                #{index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}