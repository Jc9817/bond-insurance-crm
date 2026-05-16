import { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  action?: ReactNode
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-start justify-between mb-7">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
