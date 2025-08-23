/**
 * Production-Safe Logger Utility
 * Prevents sensitive information leakage in production builds
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

export const logger = {
  /**
   * Log general information (only in development)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * Log information with minimal production output
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    } else {
      // Only log the first argument (should be a safe message) in production
      console.info(args[0] || 'Info')
    }
  },

  /**
   * Log warnings (always shown but sanitized in production)
   */
  warn: (...args: any[]) => {
    if (isDevelopment || isTest) {
      console.warn(...args)
    } else {
      // Generic warning in production
      console.warn('Warning: An issue occurred')
    }
  },

  /**
   * Log errors (always shown but sanitized in production)
   */
  error: (...args: any[]) => {
    if (isDevelopment || isTest) {
      console.error(...args)
    } else {
      // Only log generic error message in production
      console.error('An error occurred')
    }
  },

  /**
   * Debug logging (only in development)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },

  /**
   * API request logging (development only)
   */
  apiRequest: (method: string, url: string, data?: any) => {
    if (isDevelopment) {
      console.log(`🔄 API Request: ${method.toUpperCase()} ${url}`, data ? { data } : '')
    }
  },

  /**
   * API response logging (development only)  
   */
  apiResponse: (status: number, url: string, data?: any) => {
    if (isDevelopment) {
      console.log(`✅ API Response: ${status} ${url}`, data ? { data } : '')
    }
  },

  /**
   * User interaction logging (development only)
   */
  userAction: (action: string, details?: any) => {
    if (isDevelopment) {
      console.log(`👤 User Action: ${action}`, details || '')
    }
  },

  /**
   * Performance logging (development only)
   */
  performance: (label: string, time?: number) => {
    if (isDevelopment) {
      console.log(`⚡ Performance: ${label}${time ? ` (${time}ms)` : ''}`)
    }
  }
}

/**
 * Safe error logging for production
 * Logs detailed error in development, generic message in production
 */
export const logSafeError = (error: unknown, context?: string) => {
  if (isDevelopment || isTest) {
    console.error(`❌ Error${context ? ` in ${context}` : ''}:`, error)
  } else {
    // Only log that an error occurred, not the details
    console.error(`An error occurred${context ? ` in ${context}` : ''}`)
  }
}

/**
 * Safe success logging for production
 * Logs detailed message in development, generic success in production
 */
export const logSafeSuccess = (message: string, details?: any) => {
  if (isDevelopment) {
    console.log(`✅ ${message}`, details || '')
  } else {
    console.log('✅ Operation completed successfully')
  }
}

export default logger