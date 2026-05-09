import React, { useReducer, useEffect, useState } from 'react'
import { loadCatalog, presets } from './catalog'
import type { CatalogManifest, KernelTarget, Topology, GeodataSource, RuleFormat, Sub, CustomGroup } from './types'
import { CoreSection } from './components/CoreSection'
import { ProxiesSection } from './components/ProxiesSection'
import { OutputPanel } from './components/OutputPanel'
import { ModeToggle } from './components/ModeToggle'


export interface AppState {
  mode: 'simple' | 'advanced'
  // §1 Core
  target: KernelTarget
  geodata: GeodataSource
  tun: boolean
  dashboard: boolean
  // §2 Proxies & rules
  subs: Sub[]
  blockAds: boolean
  blockTracking: boolean
  blockQuic: boolean
  loadBalance: boolean
  // §2 simple mode
  preset: string
  presetGroups: string[]
  // §2 advanced mode
  topology: Topology
  format: RuleFormat
  regionExcludes: string
  selectedGroups: string[]
  customGroups: CustomGroup[]
  // Output
  output: string
  generating: boolean
  error: string | null
}

export type Action =
  | { type: 'SET_MODE'; mode: 'simple' | 'advanced' }
  | { type: 'SET_TARGET'; target: KernelTarget }
  | { type: 'SET_GEODATA'; geodata: GeodataSource }
  | { type: 'SET_TUN'; tun: boolean }
  | { type: 'SET_DASHBOARD'; dashboard: boolean }
  | { type: 'SET_SUBS'; subs: Sub[] }
  | { type: 'SET_PRESET'; preset: string; groups: string[]; features?: Record<string, boolean>; topology?: Topology }
  | { type: 'SET_TOPOLOGY'; topology: Topology }
  | { type: 'SET_FORMAT'; format: RuleFormat }
  | { type: 'SET_REGION_EXCLUDES'; regionExcludes: string }
  | { type: 'SET_SELECTED_GROUPS'; selectedGroups: string[] }
  | { type: 'SET_CUSTOM_GROUPS'; customGroups: CustomGroup[] }
  | { type: 'TOGGLE_FEATURE'; key: 'blockAds' | 'blockTracking' | 'blockQuic' | 'loadBalance'; value: boolean }
  | { type: 'SET_OUTPUT'; output: string }
  | { type: 'SET_GENERATING'; generating: boolean }
  | { type: 'SET_ERROR'; error: string | null }

const initialState: AppState = {
  mode: 'simple',
  target: 'mihomo',
  geodata: 'metacubex',
  tun: false,
  dashboard: false,
  subs: [],
  blockAds: true,
  blockTracking: false,
  blockQuic: false,
  loadBalance: false,
  preset: 'standard',
  presetGroups: [],
  topology: 'regional',
  format: 'yaml-split',
  regionExcludes: '',
  selectedGroups: [],
  customGroups: [],
  output: '',
  generating: false,
  error: null,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODE': return { ...state, mode: action.mode }
    case 'SET_TARGET': return { ...state, target: action.target }
    case 'SET_GEODATA': return { ...state, geodata: action.geodata }
    case 'SET_TUN': return { ...state, tun: action.tun }
    case 'SET_DASHBOARD': return { ...state, dashboard: action.dashboard }
    case 'SET_SUBS': return { ...state, subs: action.subs }
    case 'SET_PRESET': return {
      ...state,
      preset: action.preset,
      presetGroups: action.groups,
      topology: action.topology ?? state.topology,
      blockAds: action.features?.ads_block ?? state.blockAds,
      blockTracking: action.features?.tracking_block ?? state.blockTracking,
      blockQuic: action.features?.quic_block ?? state.blockQuic,
      loadBalance: action.features?.load_balance ?? state.loadBalance,
    }
    case 'SET_TOPOLOGY': return { ...state, topology: action.topology }
    case 'SET_FORMAT': return { ...state, format: action.format }
    case 'SET_REGION_EXCLUDES': return { ...state, regionExcludes: action.regionExcludes }
    case 'SET_SELECTED_GROUPS': return { ...state, selectedGroups: action.selectedGroups }
    case 'SET_CUSTOM_GROUPS': return { ...state, customGroups: action.customGroups }
    case 'TOGGLE_FEATURE': return { ...state, [action.key]: action.value }
    case 'SET_OUTPUT': return { ...state, output: action.output, error: null }
    case 'SET_GENERATING': return { ...state, generating: action.generating }
    case 'SET_ERROR': return { ...state, error: action.error }
    default: return state
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [catalog, setCatalog] = useState<CatalogManifest | null>(null)

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => setCatalog({ items: {} }))
  }, [])

  // Apply default preset on mount
  useEffect(() => {
    const p = (presets as Record<string, any>)['standard']
    if (p) {
      dispatch({
        type: 'SET_PRESET',
        preset: 'standard',
        groups: p.groups || [],
        features: p.features,
        topology: p.topology,
      })
    }
  }, [])

  // Preload generator in background after initial render
  useEffect(() => {
    import('hajimihomo-generator').catch(() => {})
  }, [])

  async function handleGenerate() {
    if (!catalog) return
    dispatch({ type: 'SET_GENERATING', generating: true })
    dispatch({ type: 'SET_ERROR', error: null })

    try {
      const { buildFullProfile, buildProfileFromCustomGroups } = await import('hajimihomo-generator')
      const subUrls = state.subs.map(s => s.url)
      const features = {
        ads_block: state.blockAds,
        tracking_block: state.blockTracking,
        quic_block: state.blockQuic,
        load_balance: state.loadBalance,
        tun_enable: state.tun,
        dashboard: state.dashboard,
      }
      const opts = {
        topology: state.topology,
        target: state.target,
        features,
        geodata: state.geodata,
        format: state.format,
        regionExcludes: state.regionExcludes,
      }

      let output: string
      if (state.mode === 'advanced' && state.customGroups.length > 0) {
        output = buildProfileFromCustomGroups(subUrls, state.customGroups, catalog, opts)
      } else {
        const groupIds = state.mode === 'simple' ? state.presetGroups : state.selectedGroups
        output = buildFullProfile(subUrls, groupIds, catalog, opts)
      }
      dispatch({ type: 'SET_OUTPUT', output })
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) })
    } finally {
      dispatch({ type: 'SET_GENERATING', generating: false })
    }
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-1">hajimihomo</h1>
        <p className="text-sm opacity-50 mb-6">代理规则配置生成工具 · mihomo / sing-box</p>
        <div className="text-xs border border-base-300 border-l-4 rounded px-4 py-3 mb-6 opacity-60">
          个人使用，不保证稳定性。规则集来源于公开上游，按需自取。
        </div>

        <ModeToggle mode={state.mode} onChange={mode => dispatch({ type: 'SET_MODE', mode })} />
        <CoreSection state={state} dispatch={dispatch} />
        <ProxiesSection state={state} dispatch={dispatch} catalog={catalog} />
        <OutputPanel
          output={state.output}
          error={state.error}
          generating={state.generating}
          onGenerate={handleGenerate}
          target={state.target}
          mode={state.mode}
          preset={state.preset}
        />
      </main>
    </div>
  )
}

// Mount React app
import { createRoot } from 'react-dom/client'
const root = document.getElementById('root')!
createRoot(root).render(<App />)
