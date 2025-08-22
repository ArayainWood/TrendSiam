'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

interface PDFDownloadLinkProps {
  className?: string
  children?: React.ReactNode
  pdfUrl?: string
  filename?: string
  variant?: 'button' | 'link'
}

export function PDFDownloadLink({ 
  className = '', 
  children, 
  pdfUrl = '/trendsiam_report.pdf',
  filename = 'TrendSiam_Weekly_Report.pdf',
  variant = 'button'
}: PDFDownloadLinkProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    
    try {
      setIsDownloading(true)
      
      // Add cache-busting timestamp
      const timestamp = Date.now()
      const cacheBustedUrl = `${pdfUrl}?ts=${timestamp}`
      
      console.log(`📄 Downloading PDF: ${cacheBustedUrl}`)
      
      // For direct download, create a temporary link element
      const link = document.createElement('a')
      link.href = cacheBustedUrl
      link.download = filename
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      
      // Add to DOM, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log(`✅ PDF download initiated: ${filename}`)
      
    } catch (error) {
      console.error('❌ PDF download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const baseClasses = variant === 'button' 
    ? "inline-flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-white font-medium rounded-lg transition-colors focus-ring"
    : "inline-flex items-center gap-2 text-accent-500 hover:text-accent-600 transition-colors"

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className={`${baseClasses} ${className}`}
      title="Download latest PDF report"
    >
      {isDownloading ? (
        <LoadingSpinner size="sm" className="text-white" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      {children || (isDownloading ? 'Downloading...' : 'Download PDF')}
    </button>
  )
}

// Export with cache-busting URL generator
export const generatePDFUrl = (baseUrl: string = '/trendsiam_report.pdf'): string => {
  const timestamp = Date.now()
  return `${baseUrl}?ts=${timestamp}`
}

// Export for static use in Next.js
export const CACHE_BUSTED_PDF_URL = () => generatePDFUrl()