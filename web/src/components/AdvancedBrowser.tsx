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
  PROXY: 'badge-info',
  REJECT: 'badge-error',
  DIRECT: 'badge-success',
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
    <div className="card bg-base-200 min-h-96 flex flex-col">
      <div className="card-body p-3 flex flex-col gap-2 h-full">
        <div className="text-xs font-bold uppercase tracking-widest opacity-50">规则组浏览</div>
        <input
          className="input input-bordered input-sm w-full"
          placeholder="筛选..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto space-y-1">
          {Object.entries(groupsByTier).sort().map(([tier, groups]) => (
            <div key={tier} className="collapse collapse-arrow bg-base-100">
              <input
                type="checkbox"
                checked={expanded.has(tier)}
                onChange={() => toggleExpand(tier)}
              />
              <div className="collapse-title text-xs flex items-center gap-2 py-2 min-h-0">
                <span className="flex-1">{TIER_LABELS[tier as Tier] ?? tier}</span>
                <span
                  className="opacity-50 hover:opacity-100 px-1"
                  onClick={e => { e.stopPropagation(); selectAll(tier) }}
                >全选</span>
                <span className="opacity-50">{groups.filter(([gid]) => selected.has(gid)).length}/{groups.length}</span>
              </div>
              <div className="collapse-content">
                <div className="space-y-0.5 pt-1">
                  {groups.map(([gid, info]) => (
                    <label
                      key={gid}
                      className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-base-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-xs shrink-0"
                        checked={selected.has(gid)}
                        onChange={() => toggle(gid)}
                      />
                      <span className="text-xs flex-1">{info.name || gid}</span>
                      <span className={`badge badge-xs ${ACTION_BADGE[info.defaultAction] ?? 'badge-ghost'}`}>
                        {info.defaultAction}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
