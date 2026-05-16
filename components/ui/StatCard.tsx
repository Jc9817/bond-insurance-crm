type Props = {
  label: string
  value: string | number
  sub?: string
  color?: 'default' | 'blue' | 'amber' | 'red' | 'green'
}

const bg: Record<string, string> = {
  default: 'bg-white border-gray-100',
  blue:    'bg-blue-50 border-blue-100',
  amber:   'bg-amber-50 border-amber-100',
  red:     'bg-red-50 border-red-100',
  green:   'bg-green-50 border-green-100',
}

const val: Record<string, string> = {
  default: 'text-gray-900',
  blue:    'text-blue-700',
  amber:   'text-amber-700',
  red:     'text-red-600',
  green:   'text-green-700',
}

const lbl: Record<string, string> = {
  default: 'text-gray-500',
  blue:    'text-blue-600',
  amber:   'text-amber-600',
  red:     'text-red-500',
  green:   'text-green-600',
}

export default function StatCard({ label, value, sub, color = 'default' }: Props) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${bg[color]}`}>
      <p className={`text-sm font-medium ${lbl[color]}`}>{label}</p>
      <p className={`text-3xl font-bold mt-1 tracking-tight ${val[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
