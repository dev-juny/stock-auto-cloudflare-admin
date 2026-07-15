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
  const kst = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return kst
}

export function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}시간 ${m}분`
}

export function formatStockDisplay(name: string | null | undefined, code: string | null | undefined): string {
  if (name && code && name !== code) return `${name} (${code})`
  return code || name || '-'
}
