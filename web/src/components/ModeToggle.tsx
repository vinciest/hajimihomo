import React from 'react'

interface Props {
  mode: 'simple' | 'advanced'
  onChange: (mode: 'simple' | 'advanced') => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="tabs tabs-boxed w-fit mx-auto mb-4">
      <a
        className={`tab ${mode === 'simple' ? 'tab-active' : ''}`}
        onClick={() => onChange('simple')}
      >📋 简单模式</a>
      <a
        className={`tab ${mode === 'advanced' ? 'tab-active' : ''}`}
        onClick={() => onChange('advanced')}
      >⚙️ 高级模式</a>
    </div>
  )
}
