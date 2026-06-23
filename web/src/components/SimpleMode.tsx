import React from 'react'
import { presets, GROUP_CATEGORIES, deriveCategoryStates } from '../catalog'
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

  // Derive effective category states: preset defaults + user overrides
  const presetDefaults = deriveCategoryStates(state.presetGroups)
  const effectiveCategories = GROUP_CATEGORIES.map(cat => ({
    ...cat,
    enabled: state.categoryOverrides[cat.id] ?? presetDefaults[cat.id] ?? false,
    isOverridden: cat.id in state.categoryOverrides,
  }))

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

      {/* Category toggles */}
      <div>
        <label className="label"><span className="label-text">代理分组</span></label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {effectiveCategories.map(cat => (
            <label key={cat.id} className="label gap-2 cursor-pointer justify-start">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={cat.enabled}
                onChange={e => dispatch({ type: 'SET_CATEGORY_OVERRIDE', categoryId: cat.id, value: e.target.checked })}
              />
              <span className="label-text">{cat.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
