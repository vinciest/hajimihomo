import React, { useState } from 'react'
import { presets } from '../catalog'
import type { AppState, Action } from '../App'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const selectCls = "w-full px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
const inputCls = "flex-1 px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd] placeholder:text-[#484f58]"
const btnCls = "px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors"

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" className="accent-[#388bfd]" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function SimpleMode({ state, dispatch }: Props) {
  const [newUrl, setNewUrl] = useState('')

  function addSub() {
    const url = newUrl.trim()
    if (!url) return
    dispatch({ type: 'SET_SUBS', subs: [...state.subs, { name: `Airport ${state.subs.length + 1}`, url }] })
    setNewUrl('')
  }

  function removeSub(i: number) {
    dispatch({ type: 'SET_SUBS', subs: state.subs.filter((_, idx) => idx !== i) })
  }

  function handlePreset(key: string) {
    if (key === 'custom') {
      dispatch({ type: 'SET_PRESET', preset: 'custom', groups: [] })
      return
    }
    const p = (presets as Record<string, any>)[key]
    if (!p) return
    dispatch({ type: 'SET_PRESET', preset: key, groups: p.groups || [], features: p.features, topology: p.topology })
  }

  return (
    <div className="space-y-5">
      {/* Subscription URLs */}
      <div>
        <label className="block text-xs text-[#8b949e] mb-2">订阅链接</label>
        <div className="space-y-2 mb-2">
          {state.subs.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-xs font-mono truncate bg-[#161b22] border border-[#30363d] rounded px-2 py-1">{s.url}</span>
              <button
                onClick={() => removeSub(i)}
                className={`${btnCls} bg-transparent border-[#30363d] text-[#8b949e] hover:text-[#ff7b72] hover:border-[#ff7b72]`}
              >✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="https://your-subscription-url/..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSub()}
          />
          <button
            onClick={addSub}
            className={`${btnCls} bg-[#1f6feb] border-[#1f6feb] text-white hover:bg-[#388bfd]`}
          >添加</button>
        </div>
      </div>

      {/* Preset picker */}
      <div>
        <label className="block text-xs text-[#8b949e] mb-2">预设</label>
        <select className={selectCls} value={state.preset} onChange={e => handlePreset(e.target.value)}>
          <option value="custom">自定义</option>
          {Object.entries(presets as Record<string, any>).map(([name, data]) => (
            <option key={name} value={name}>{name} — {data.description || ''}</option>
          ))}
        </select>
      </div>

      {/* Blocking toggles */}
      <div>
        <label className="block text-xs text-[#8b949e] mb-2">拦截规则</label>
        <div className="flex flex-wrap gap-4">
          <Toggle label="广告拦截" checked={state.blockAds} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockAds', value: v })} />
          <Toggle label="追踪拦截" checked={state.blockTracking} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockTracking', value: v })} />
          <Toggle label="屏蔽 QUIC" checked={state.blockQuic} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockQuic', value: v })} />
        </div>
      </div>
    </div>
  )
}
