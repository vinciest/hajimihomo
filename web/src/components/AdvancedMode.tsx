import React from 'react'
import type { AppState, Action } from '../App'
import { AdvancedBrowser } from './AdvancedBrowser'
import { CustomGroups } from './CustomGroups'
import type { CatalogManifest } from '../types'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
  catalog: CatalogManifest | null
}

const selectCls = "w-full px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"
const inputCls = "w-full px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd] placeholder:text-[#484f58]"

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" className="accent-[#388bfd]" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function AdvancedMode({ state, dispatch, catalog }: Props) {
  const isSingbox = state.target === 'singbox'

  return (
    <div className="space-y-5">
      {/* Controls grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isSingbox && (
          <div>
            <label className="block text-xs text-[#8b949e] mb-2">分组结构</label>
            <select
              className={selectCls}
              value={state.topology}
              onChange={e => dispatch({ type: 'SET_TOPOLOGY', topology: e.target.value as any })}
            >
              <option value="global">全局 — 单一代理池</option>
              <option value="regional">分区 — 各地区独立测速（推荐）</option>
              <option value="advanced">高级 — 分区 + 负载均衡</option>
            </select>
          </div>
        )}

        {!isSingbox && (
          <div>
            <label className="block text-xs text-[#8b949e] mb-2">规则集格式</label>
            <select
              className={selectCls}
              value={state.format}
              onChange={e => dispatch({ type: 'SET_FORMAT', format: e.target.value as any })}
            >
              <option value="yaml-split">YAML 分离（推荐）</option>
              <option value="yaml-classical">YAML 经典</option>
              <option value="binary">Binary .mrs</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-[#8b949e] mb-2">排除节点关键词（正则）</label>
          <input
            className={inputCls}
            placeholder="例: 5x|10x|0.5x"
            value={state.regionExcludes}
            onChange={e => dispatch({ type: 'SET_REGION_EXCLUDES', regionExcludes: e.target.value })}
          />
        </div>
      </div>

      {/* Blocking toggles */}
      <div>
        <label className="block text-xs text-[#8b949e] mb-2">拦截规则</label>
        <div className="flex flex-wrap gap-4">
          <Toggle label="广告拦截" checked={state.blockAds} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockAds', value: v })} />
          <Toggle label="追踪拦截" checked={state.blockTracking} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockTracking', value: v })} />
          <Toggle label="屏蔽 QUIC" checked={state.blockQuic} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'blockQuic', value: v })} />
          {state.topology === 'advanced' && (
            <Toggle label="负载均衡" checked={state.loadBalance} onChange={v => dispatch({ type: 'TOGGLE_FEATURE', key: 'loadBalance', value: v })} />
          )}
        </div>
      </div>

      {/* Browser + Groups side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdvancedBrowser
          selectedGroups={state.selectedGroups}
          onSelectionChange={groups => dispatch({ type: 'SET_SELECTED_GROUPS', selectedGroups: groups })}
        />
        <CustomGroups
          groups={state.customGroups}
          onChange={groups => dispatch({ type: 'SET_CUSTOM_GROUPS', customGroups: groups })}
        />
      </div>

      <p className="text-xs text-[#8b949e]">
        左侧勾选规则组；高级模式下右侧可创建自定义代理组并拖动排序。
      </p>
    </div>
  )
}
