/**
 * Auto-refresh utility for periodic page updates
 */

let refreshInterval: NodeJS.Timeout | null = null

/**
 * Start auto-refresh with the specified interval
 * @param minutes - Refresh interval in minutes
 * @returns Cleanup function to stop the auto-refresh
 */
export function startAutoRefresh(minutes: number): () => void {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  
  // Convert minutes to milliseconds
  const intervalMs = minutes * 60 * 1000
  
  console.log(`🔄 Starting auto-refresh every ${minutes} minutes (${intervalMs}ms)`)
  
  // Set up the interval
  refreshInterval = setInterval(() => {
    console.log('🔄 Auto-refresh triggered - reloading page...')
    window.location.reload()
  }, intervalMs)
  
  // Return cleanup function
  return () => {
    if (refreshInterval) {
      console.log('🛑 Stopping auto-refresh')
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

/**
 * Stop the current auto-refresh interval
 */
export function stopAutoRefresh(): void {
  if (refreshInterval) {
    console.log('🛑 Stopping auto-refresh')
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

/**
 * Check if auto-refresh is currently active
 */
export function isAutoRefreshActive(): boolean {
  return refreshInterval !== null
}
