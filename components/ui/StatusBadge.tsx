type Props = { status: string; size?: 'sm' | 'md' }

const styleMap: Record<string, string> = {
  // Case statuses
  Created: 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-50 text-blue-700',
  // Follow-up status
  Open: 'bg-blue-50 text-blue-700',
  Done: 'bg-green-50 text-green-700',
  // Result
  Won: 'bg-green-50 text-green-700',
  Lost: 'bg-red-50 text-red-600',
  Cancelled: 'bg-gray-100 text-gray-500',
  'On Hold': 'bg-amber-50 text-amber-700',
  // AI scan status
  Pending: 'bg-amber-50 text-amber-700',
}

const iconMap: Record<string, string> = {
  Created: '○',
  'In Progress': '→',
  Open: '○',
  Done: '✓',
  Won: '★',
  Lost: '✕',
  Cancelled: '—',
  'On Hold': '⏸',
  Pending: '○',
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const style = styleMap[status] ?? 'bg-gray-100 text-gray-600'
  const sz = size === 'md' ? 'px-3 py-1 text-sm gap-1.5' : 'px-2.5 py-0.5 text-xs gap-1'
  const icon = iconMap[status]
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style} ${sz}`}>
      {icon && <span className="opacity-70 leading-none">{icon}</span>}
      {status}
    </span>
  )
}
