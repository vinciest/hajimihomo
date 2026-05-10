import React from 'react'
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
  function handlePreset(key: string) {
    const p = (presets as Record<string, any>)[key]
    if (!p) return
    dispatch({ type: 'SET_PRESET', preset: key, groups: p.groups || [], features: p.features, topology: p.topology })
  }

  return (
    <div className="space-y-5">
      {/* Preset picker */}
      <div className="form-control">
        <label className="label"><span className="label-text">预设</span></label>
        <select className="select select-bordered w-full" value={state.preset} onChange={e => handlePreset(e.target.value)}>
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
