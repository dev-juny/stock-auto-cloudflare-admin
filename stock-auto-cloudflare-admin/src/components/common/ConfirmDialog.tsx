import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'primary', loading = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const btnColor = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-primary hover:bg-primary/90 text-white'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 max-w-sm w-full mx-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <button onClick={onCancel} className="ml-auto text-text-muted hover:text-text">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs text-text-muted mb-4">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-border text-text-muted hover:text-text transition-colors disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${btnColor}`}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
