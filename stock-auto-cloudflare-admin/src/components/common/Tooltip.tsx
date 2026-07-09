import { useState, useRef, type ReactNode } from 'react'
import { Info } from 'lucide-react'

interface TooltipProps {
  text?: string
  content?: string
  children?: ReactNode
  direction?: 'top' | 'bottom' | 'left' | 'right'
  size?: number
  className?: string
}

export function Tooltip({ text, content, children, direction = 'top', size = 14, className = '' }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const tooltipText = text || content || ''

  const posStyles: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span
      className={`relative inline-flex items-center gap-1 ${className}`}
      onMouseEnter={() => {
        clearTimeout(timeoutRef.current)
        setShow(true)
      }}
      onMouseLeave={() => {
        timeoutRef.current = setTimeout(() => setShow(false), 200)
      }}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      onClick={(e) => {
        e.stopPropagation()
        setShow(s => !s)
      }}
    >
      {children}
      {tooltipText && (
        <>
          <Info size={size} className="text-text-muted hover:text-text cursor-pointer transition-colors shrink-0" />
          {show && (
            <span
              className={`absolute z-50 ${posStyles[direction]} min-w-[200px] max-w-[280px] p-2.5 text-xs leading-relaxed text-white bg-gray-800 rounded-lg shadow-lg pointer-events-none`}
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
            >
              {tooltipText}
            </span>
          )}
        </>
      )}
    </span>
  )
}
