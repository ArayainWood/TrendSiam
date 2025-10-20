'use client'


import { useEffect, useState } from 'react'
import { supabase, supabaseUtils } from '../../lib/supabaseClient'
import { NewsTrend } from '../../types'
import { SupabaseNewsGrid } from '../../components/news/SupabaseNewsGrid'
import type { HomeNewsItem } from '../../lib/data/newsClient'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

interface TestResult {
  name: string
  status: 'success' | 'error' | 'warning' | 'pending'
  message: string
  details?: any
}

export default function SupabaseTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [healthInfo, setHealthInfo] = useState<any>(null)
  const [selectedNews, setSelectedNews] = useState<HomeNewsItem | null>(null)

  useEffect(() => {
    // Get health info on component mount
    setHealthInfo(supabaseUtils.getHealthInfo())
  }, [])

  const runSecurityTests = async () => {
    setIsRunningTests(true)
    const results: TestResult[] = []

    // Test 1: Environment Configuration
    results.push({
      name: 'Environment Configuration',
      status: supabaseUtils.isConfigured() ? 'success' : 'error',
      message: supabaseUtils.isConfigured() 
        ? 'Supabase environment variables are properly configured'
        : 'Missing required environment variables (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)',
      details: healthInfo
    })

    // Test 2: Connection Test
    try {
      const isConnected = await supabaseUtils.testConnection()
      results.push({
        name: 'Database Connection',
        status: isConnected ? 'success' : 'error',
        message: isConnected 
          ? 'Successfully connected to Supabase database'
          : 'Failed to connect to database - check your credentials and table existence',
      })
    } catch (error) {
      results.push({
        name: 'Database Connection',
        status: 'error',
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }

    // Test 3: Table Structure Check
    try {
      const { data: tableInfo, error } = await supabase
        .from('v_home_news')
        .select('*')
        .limit(1)

      if (error) {
        results.push({
          name: 'Table Structure',
          status: 'error',
          message: `Table check failed: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          name: 'View Structure',
          status: 'success',
          message: 'v_home_news view exists and is accessible',
          details: tableInfo
        })
      }
    } catch (error) {
      results.push({
        name: 'Table Structure',
        status: 'error',
        message: `Unexpected error checking table: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }

    // Test 4: RLS Policy Check (Read Access)
    try {
      const { data, error } = await supabase
        .from('v_home_news')
        .select('count', { count: 'exact', head: true })

      if (error) {
        results.push({
          name: 'Row Level Security (Read)',
          status: 'error',
          message: `RLS read policy failed: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          name: 'Row Level Security (Read)',
          status: 'success',
          message: 'Public read access is working correctly',
          details: { recordCount: data }
        })
      }
    } catch (error) {
      results.push({
        name: 'Row Level Security (Read)',
        status: 'error',
        message: `RLS test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }

    // Test 5: Data Fetching
    try {
      const { data, error } = await supabase
        .from('v_home_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        results.push({
          name: 'Data Fetching',
          status: 'error',
          message: `Data fetch failed: ${error.message}`,
          details: error
        })
      } else {
        results.push({
          name: 'Data Fetching',
          status: data && data.length > 0 ? 'success' : 'warning',
          message: data && data.length > 0 
            ? `Successfully fetched ${data.length} records`
            : 'No data found in the table - consider adding sample data',
          details: data
        })
      }
    } catch (error) {
      results.push({
        name: 'Data Fetching',
        status: 'error',
        message: `Unexpected error fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }

    // Test 6: Security Validation
    const envVars = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlFormat: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') && 
                 process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co'),
      keyFormat: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ'),
    }

    results.push({
      name: 'Security Configuration',
      status: envVars.hasSupabaseUrl && envVars.hasAnonKey && envVars.urlFormat && envVars.keyFormat 
        ? 'success' : 'warning',
      message: 'Environment variables security check',
      details: {
        ...envVars,
        note: 'Ensure you are using anon key (not service_role key) in frontend'
      }
    })

    setTestResults(results)
    setIsRunningTests(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'pending':
        return '⏳'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'pending':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-void-950 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-heading font-bold text-concrete-900 dark:text-white mb-4">
            Supabase Integration Test
          </h1>
          <p className="text-concrete-600 dark:text-concrete-400 text-lg">
            Verify your Supabase configuration and test all security measures.
          </p>
        </div>

        {/* Health Info */}
        {healthInfo && (
          <div className="bg-concrete-50 dark:bg-void-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-concrete-900 dark:text-white mb-4">
              Configuration Status
            </h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-concrete-700 dark:text-concrete-300">URL:</span>
                <p className="text-concrete-600 dark:text-concrete-400 font-mono break-all">
                  {healthInfo.url || 'Not configured'}
                </p>
              </div>
              <div>
                <span className="font-medium text-concrete-700 dark:text-concrete-300">Key Status:</span>
                <p className={`${healthInfo.hasKey ? 'text-green-600' : 'text-red-600'}`}>
                  {healthInfo.hasKey ? '✅ Configured' : '❌ Missing'}
                </p>
              </div>
              <div>
                <span className="font-medium text-concrete-700 dark:text-concrete-300">Key Preview:</span>
                <p className="text-concrete-600 dark:text-concrete-400 font-mono">
                  {healthInfo.keyPreview}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Test Controls */}
        <div className="mb-8">
          <button
            onClick={runSecurityTests}
            disabled={isRunningTests}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunningTests ? (
              <>
                <LoadingSpinner size="sm" />
                Running Tests...
              </>
            ) : (
              'Run Security & Integration Tests'
            )}
          </button>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="bg-white dark:bg-void-900 rounded-lg border border-concrete-200 dark:border-void-800 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-concrete-200 dark:border-void-800">
              <h2 className="text-xl font-semibold text-concrete-900 dark:text-white">
                Test Results
              </h2>
            </div>
            <div className="divide-y divide-concrete-200 dark:divide-void-800">
              {testResults.map((result, index) => (
                <div key={index} className="p-6">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{getStatusIcon(result.status)}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-concrete-900 dark:text-white mb-2">
                        {result.name}
                      </h3>
                      <p className={`mb-2 ${getStatusColor(result.status)}`}>
                        {result.message}
                      </p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-concrete-500 dark:text-concrete-500 hover:text-concrete-700 dark:hover:text-concrete-300">
                            View Details
                          </summary>
                          <pre className="mt-2 text-xs bg-concrete-100 dark:bg-void-800 p-3 rounded-lg overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Data Test */}
        <div className="bg-white dark:bg-void-900 rounded-lg border border-concrete-200 dark:border-void-800 p-6">
          <h2 className="text-xl font-semibold text-concrete-900 dark:text-white mb-6">
            Live Data Integration Test
          </h2>
          <SupabaseNewsGrid 
            limit={6}
            onNewsItemClick={setSelectedNews}
          />
        </div>

        {/* Selected News Modal */}
        {selectedNews && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-void-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-concrete-900 dark:text-white">
                    News Details
                  </h3>
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="text-concrete-500 hover:text-concrete-700 dark:text-concrete-400 dark:hover:text-concrete-200"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-concrete-900 dark:text-white">Title:</h4>
                    <p className="text-concrete-600 dark:text-concrete-400">{selectedNews.title}</p>
                  </div>
                  
                  {selectedNews.summary && (
                    <div>
                      <h4 className="font-medium text-concrete-900 dark:text-white">Summary:</h4>
                      <p className="text-concrete-600 dark:text-concrete-400">{selectedNews.summary}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-concrete-900 dark:text-white">Platform:</h4>
                      <p className="text-concrete-600 dark:text-concrete-400">{selectedNews.platform || 'N/A'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-concrete-900 dark:text-white">Score:</h4>
                      <p className="text-concrete-600 dark:text-concrete-400">{selectedNews.popularity_score || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-concrete-500 dark:text-concrete-500 bg-concrete-50 dark:bg-void-800 p-3 rounded">
                    <strong>ID:</strong> {selectedNews.id}<br />
                    <strong>Created:</strong> {selectedNews.created_at ? (() => {
                      try {
                        return new Date(selectedNews.created_at).toLocaleString()
                      } catch {
                        return 'Invalid date'
                      }
                    })() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

