import React from 'react'
import { SimpleMode } from './SimpleMode'
import { AdvancedMode } from './AdvancedMode'
import type { AppState, Action } from '../App'
import type { CatalogManifest } from '../types'

interface Props {
  state: AppState
  dispatch: React.Dispatch<Action>
  catalog: CatalogManifest | null
}

export function ProxiesSection({ state, dispatch, catalog }: Props) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-[#58a6ff] tracking-wider border-t border-[#30363d] pt-3 mb-3">
        §2 &nbsp; 代理 &amp; 规则
      </div>
      {state.mode === 'simple'
        ? <SimpleMode state={state} dispatch={dispatch} />
        : <AdvancedMode state={state} dispatch={dispatch} catalog={catalog} />
      }
    </div>
  )
}
