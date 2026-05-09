import React from 'react'
import type { AppState, Action } from '../App'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const selectCls = "w-full px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd]"

export function CoreSection({ state, dispatch }: Props) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-[#58a6ff] tracking-wider border-t border-[#30363d] pt-3 mb-3">
        §1 &nbsp; 核心配置
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-[#8b949e] mb-2">内核 / 输出格式</label>
          <select
            className={selectCls}
            value={state.target}
            onChange={e => dispatch({ type: 'SET_TARGET', target: e.target.value as any })}
          >
            <option value="mihomo">mihomo (Clash Meta)</option>
            <option value="mihomo-smart">mihomo-smart (vernesong fork) — smart 分组</option>
            <option value="singbox">sing-box — 路由规则片段</option>
          </select>
        </div>

        {state.mode === 'advanced' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {state.target !== 'singbox' && (
              <div>
                <label className="block text-xs text-[#8b949e] mb-2">地理数据源</label>
                <select
                  className={selectCls}
                  value={state.geodata}
                  onChange={e => dispatch({ type: 'SET_GEODATA', geodata: e.target.value as any })}
                >
                  <option value="metacubex">MetaCubeX（轻量）</option>
                  <option value="dustinwin">DustinWin（完整）</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-[#8b949e] mb-2">配置选项</label>
              <div className="flex gap-4 flex-wrap pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#388bfd]"
                    checked={state.tun}
                    onChange={e => dispatch({ type: 'SET_TUN', tun: e.target.checked })}
                  />
                  TUN 模式
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#388bfd]"
                    checked={state.dashboard}
                    onChange={e => dispatch({ type: 'SET_DASHBOARD', dashboard: e.target.checked })}
                  />
                  控制面板（:9090）
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
