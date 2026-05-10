import React, { useState } from 'react'
import { SimpleMode } from './SimpleMode'
import { AdvancedMode } from './AdvancedMode'
import type { AppState, Action } from '../App'
import type { CatalogManifest } from '../types'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
  catalog: CatalogManifest | null
}

function SubsInput({ state, dispatch }: { state: AppState; dispatch: React.Dispatch<Action> }) {
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

  return (
    <div className="form-control mb-5">
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
  )
}

export function ProxiesSection({ state, dispatch, catalog }: Props) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold uppercase tracking-widest opacity-50 my-3">§2 代理 &amp; 规则</div>
      <SubsInput state={state} dispatch={dispatch} />
      {state.mode === 'simple'
        ? <SimpleMode state={state} dispatch={dispatch} />
        : <AdvancedMode state={state} dispatch={dispatch} catalog={catalog} />
      }
    </div>
  )
}
