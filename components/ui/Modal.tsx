'use client'

import { ReactNode, useEffect } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg'
}

const widthMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${widthMap[maxWidth]} max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
            &times;
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
