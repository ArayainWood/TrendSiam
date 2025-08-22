'use client'

import { useState, useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ImageModalProps {
  src: string
  alt: string
  isOpen: boolean
  onClose: () => void
}

export function ImageModal({ src, alt, isOpen, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Reset all transformations when modal opens
      setScale(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      
      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        document.body.style.overflow = 'unset'
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation(prev => prev + 90)
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true)
      const touch = e.touches[0]
      if (touch) {
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      e.preventDefault()
      const touch = e.touches[0]
      if (touch) {
        setPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y
        })
      }
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 cursor-pointer"
        onClick={onClose}
      />
      
      {/* Controls - positioned to avoid conflicts */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-2 border border-white/20">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 hover:bg-white/10 rounded transition-colors text-white"
            title="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 hover:bg-white/10 rounded transition-colors text-white text-xs font-mono"
            title="Reset"
          >
            Reset
          </button>
        </div>

      </div>

      {/* Scale indicator */}
      <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm font-mono border border-white/20">
        {Math.round(scale * 100)}%
      </div>

      {/* Image container - isolated from controls */}
      <div className="relative max-w-[95vw] max-h-[95vh] overflow-hidden z-10">
        <img
          src={src}
          alt={alt}
          className={`max-w-none transition-transform duration-200 ${
            scale > 1 ? 'cursor-move' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x / scale}px, ${position.y / scale}px)`,
            maxWidth: scale <= 1 ? '95vw' : 'none',
            maxHeight: scale <= 1 ? '95vh' : 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            e.stopPropagation()
            if (scale === 1) {
              handleZoomIn()
            }
          }}
          draggable={false}
        />
      </div>

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm text-center max-w-[90vw] border border-white/20">
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-xs">
          <span>Tap/click to zoom</span>
          <span className="hidden md:inline">•</span>
          <span>Drag to pan</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">Press Esc or click outside to close</span>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}