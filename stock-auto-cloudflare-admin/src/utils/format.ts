export function formatKRW(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '₩0'
  return '₩' + Math.round(v).toLocaleString()
}

export function formatPct(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '0.00%'
  const sign = v >= 0 ? '+' : ''
  return sign + v.toFixed(2) + '%'
}

export function formatNumber(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '0'
  return v.toLocaleString()
}

export function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${min}`
}

export function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}시간 ${m}분`
}
