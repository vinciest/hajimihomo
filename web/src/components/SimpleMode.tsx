import React, { useState } from 'react'
import { presets } from '../catalog'
import type { AppState, Action } from '../App'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="label gap-2 cursor-pointer justify-start">
      <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="label-text">{label}</span>
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
      <div className="form-control">
        <label className="label"><span className="label-text">订阅链接</span></label>
        <div className="space-y-2 mb-2">
          {state.subs.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 input input-bordered input-sm font-mono truncate flex items-center text-xs">{s.url}</span>
              <button
                onClick={() => removeSub(i)}
                className="btn btn-ghost btn-sm btn-square text-error"
              >✕</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input input-bordered w-full"
            placeholder="https://your-subscription-url/..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSub()}
          />
          <button onClick={addSub} className="btn btn-primary">添加</button>
        </div>
      </div>

      {/* Preset picker */}
      <div className="form-control">
        <label className="label"><span className="label-text">预设</span></label>
        <select className="select select-bordered w-full" value={state.preset} onChange={e => handlePreset(e.target.value)}>
          <option value="custom">自定义</option>
          {Object.entries(presets as Record<string, any>).map(([name, data]) => (
            <option key={name} value={name}>{name} — {data.description || ''}</option>
          ))}
        </select>
      </div>

      {/* Blocking toggles */}
      <div>
        <label className="label"><span className="label-text">拦截规则</span></label>
        <div className="flex flex-wrap gap-2">
          <Toggle label="广告拦截" checked={state.blockAds} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockAds', value: v })} />
          <Toggle label="追踪拦截" checked={state.blockTracking} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockTracking', value: v })} />
          <Toggle label="屏蔽 QUIC" checked={state.blockQuic} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockQuic', value: v })} />
        </div>
      </div>
    </div>
  )
}
