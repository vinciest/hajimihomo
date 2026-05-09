import React from 'react'
import type { AppState, Action } from '../App'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
}

export function CoreSection({ state, dispatch }: Props) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold uppercase tracking-widest opacity-50 my-3">§1 核心配置</div>
      <div className="space-y-4">
        <div className="form-control">
          <label className="label"><span className="label-text">内核 / 输出格式</span></label>
          <select
            className="select select-bordered w-full"
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
              <div className="form-control">
                <label className="label"><span className="label-text">地理数据源</span></label>
                <select
                  className="select select-bordered w-full"
                  value={state.geodata}
                  onChange={e => dispatch({ type: 'SET_GEODATA', geodata: e.target.value as any })}
                >
                  <option value="metacubex">MetaCubeX（轻量）</option>
                  <option value="dustinwin">DustinWin（完整）</option>
                </select>
              </div>
            )}
            <div className="form-control">
              <label className="label"><span className="label-text">配置选项</span></label>
              <div className="flex gap-4 flex-wrap pt-1">
                <label className="label gap-2 cursor-pointer justify-start">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={state.tun}
                    onChange={e => dispatch({ type: 'SET_TUN', tun: e.target.checked })}
                  />
                  <span className="label-text">TUN 模式</span>
                </label>
                <label className="label gap-2 cursor-pointer justify-start">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={state.dashboard}
                    onChange={e => dispatch({ type: 'SET_DASHBOARD', dashboard: e.target.checked })}
                  />
                  <span className="label-text">控制面板（:9090）</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
