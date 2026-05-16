type Props = { status: string; size?: 'sm' | 'md' }

const styleMap: Record<string, string> = {
  // Case statuses
  New: 'bg-gray-100 text-gray-600',
  'Waiting Documents': 'bg-amber-50 text-amber-700',
  Submitted: 'bg-blue-50 text-blue-700',
  Quoted: 'bg-violet-50 text-violet-700',
  'Sent to Customer': 'bg-cyan-50 text-cyan-700',
  Confirmed: 'bg-green-50 text-green-700',
  Closed: 'bg-slate-100 text-slate-500',
  // Follow-up status
  Open: 'bg-blue-50 text-blue-700',
  Done: 'bg-green-50 text-green-700',
  // Result
  Won: 'bg-green-50 text-green-700',
  Lost: 'bg-red-50 text-red-600',
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const style = styleMap[status] ?? 'bg-gray-100 text-gray-600'
  const sz = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${style} ${sz}`}>
      {status}
    </span>
  )
}
