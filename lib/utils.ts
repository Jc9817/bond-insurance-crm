export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function formatCurrency(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function getDaysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function isExpiringSoon(dateStr: string): boolean {
  const d = getDaysUntil(dateStr)
  return d !== null && d >= 0 && d <= 30
}

export function isOverdue(dateStr: string): boolean {
  const d = getDaysUntil(dateStr)
  return d !== null && d < 0
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}
