interface BadgeProps {
  variant: 'success' | 'danger' | 'warning' | 'info' | 'muted'
  children: string
  className?: string
}

const variants = {
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-primary/15 text-primary',
  muted: 'bg-surface-border text-text-muted',
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {variant === 'success' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {variant === 'danger' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {variant === 'warning' && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
