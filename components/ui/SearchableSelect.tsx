'use client'

import { useState, useRef, useEffect } from 'react'

type Option = { value: string; label: string }

type Props = {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export default function SearchableSelect({ value, options, onChange, placeholder = '— Search —', required }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Hidden native input so required validation works in forms */}
      {required && <input tabIndex={-1} required value={value} onChange={() => {}} className="absolute opacity-0 w-0 h-0" />}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {selected?.label ?? placeholder}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-3 text-center">No results found</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${o.value === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'}`}
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
