import React from 'react'

interface Props {
  mode: 'simple' | 'advanced'
  onChange: (mode: 'simple' | 'advanced') => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mb-4 flex border border-[#30363d] rounded overflow-hidden text-sm">
      {(['simple', 'advanced'] as const).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex-1 py-2 text-sm transition-colors ${
            mode === m
              ? 'bg-[#1f6feb] text-white'
              : 'bg-[#161b22] text-[#8b949e] hover:bg-[#21262d] hover:text-[#c9d1d9]'
          }`}
        >
          {m === 'simple' ? '📋 简单模式' : '⚙️ 高级模式'}
        </button>
      ))}
    </div>
  )
}
