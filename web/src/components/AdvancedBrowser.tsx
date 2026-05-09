import React, { useState, useMemo } from 'react'
import { catalogIndex } from '../catalog'
import type { CatalogGroup } from '../types'

interface Props {
  selectedGroups: string[]
  onSelectionChange: (groups: string[]) => void
  onAddToCustomGroup?: (id: string, label: string) => void
}

type Tier = 'proxy' | 'block' | 'direct' | 'meta'

const TIER_LABELS: Record<Tier, string> = {
  proxy: '🌐 代理服务',
  block: '🚫 拦截规则',
  direct: '🇨🇳 直连规则',
  meta: '📦 元规则',
}

const ACTION_BADGE: Record<string, string> = {
  PROXY: 'bg-[#1f3a5f] text-[#79c0ff]',
  REJECT: 'bg-[#3d0000] text-[#ff7b72]',
  DIRECT: 'bg-[#0d3c00] text-[#56d364]',
}

export function AdvancedBrowser({ selectedGroups, onSelectionChange, onAddToCustomGroup }: Props) {
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const selected = new Set(selectedGroups)

  const groupsByTier = useMemo(() => {
    const tiers: Record<string, Array<[string, CatalogGroup]>> = {}
    for (const [gid, info] of Object.entries(catalogIndex as Record<string, CatalogGroup>)) {
      const tier = gid.split('/')[0]
      if (!tiers[tier]) tiers[tier] = []
      if (!filter || gid.includes(filter.toLowerCase()) || (info.name || '').toLowerCase().includes(filter.toLowerCase())) {
        tiers[tier].push([gid, info])
      }
    }
    return tiers
  }, [filter])

  function toggle(gid: string) {
    const next = new Set(selected)
    if (next.has(gid)) next.delete(gid)
    else next.add(gid)
    onSelectionChange([...next])
  }

  function selectAll(tier: string) {
    const tierGroups = groupsByTier[tier] || []
    const allSelected = tierGroups.every(([gid]) => selected.has(gid))
    const next = new Set(selected)
    for (const [gid] of tierGroups) {
      if (allSelected) next.delete(gid)
      else next.add(gid)
    }
    onSelectionChange([...next])
  }

  function toggleExpand(tier: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  return (
    <div className="border border-[#30363d] rounded-lg bg-[#0d1117] p-3 min-h-[400px] flex flex-col">
      <div className="text-xs font-semibold text-[#58a6ff] mb-2">规则组浏览</div>
      <input
        className="w-full px-2 py-1.5 mb-2 bg-[#161b22] border border-[#30363d] rounded text-sm text-[#c9d1d9] focus:outline-none focus:border-[#388bfd] placeholder:text-[#484f58]"
        placeholder="筛选..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <div className="flex-1 overflow-y-auto space-y-1">
        {Object.entries(groupsByTier).sort().map(([tier, groups]) => (
          <div key={tier}>
            <div
              className="flex items-center gap-2 px-2 py-1.5 bg-[#161b22] border border-[#30363d] rounded cursor-pointer hover:border-[#388bfd] text-xs"
              onClick={() => toggleExpand(tier)}
            >
              <span className="text-[#58a6ff] text-[10px]">{expanded.has(tier) ? '▼' : '▶'}</span>
              <span className="flex-1">{TIER_LABELS[tier as Tier] ?? tier}</span>
              <span
                className="text-[#8b949e] hover:text-[#58a6ff] px-1"
                onClick={e => { e.stopPropagation(); selectAll(tier) }}
              >全选</span>
              <span className="text-[#8b949e]">{groups.filter(([gid]) => selected.has(gid)).length}/{groups.length}</span>
            </div>
            {expanded.has(tier) && (
              <div className="space-y-0.5 py-1 pl-3">
                {groups.map(([gid, info]) => (
                  <label
                    key={gid}
                    className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[#161b22] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="accent-[#388bfd] shrink-0"
                      checked={selected.has(gid)}
                      onChange={() => toggle(gid)}
                    />
                    <span className="text-xs flex-1">{info.name || gid}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ACTION_BADGE[info.defaultAction] ?? 'bg-[#21262d] text-[#8b949e]'}`}>
                      {info.defaultAction}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
