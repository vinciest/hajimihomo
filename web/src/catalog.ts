/**
 * Data layer — presets, catalog index, category index, rulesets manifest.
 *
 * Separated from ProfileBuilder so the generation engine has no dependency
 * on data loading, and any UI implementation can import data independently.
 */

import presetsData      from '../../profiles/presets.yaml'
import catalogIndexData from '../../source/catalog.yaml'
import { RULESETS_URL }  from './constants'
import type { CatalogManifest, CatalogItem } from './types'

/** Presets bundled at build time from profiles/presets.yaml — no fetch needed. */
// Defensive: Bun's native YAML loader (pre-plugin) returns {presets: {...}};
//            the Bun plugin (build.ts) returns the flat index {mini: {...}, ...}.
const _p = presetsData as any
export const presets = (_p?.mini || _p?.standard ? _p : (_p?.presets || {})) as Record<string, any>

/** @deprecated Use the presets export directly — kept for backwards compat. */
export function loadPresets() { return presets }

/** Catalog group metadata bundled at build time — keyed by group ID. */
// Defensive: Bun native YAML returns {groups: {'block/ads': {default_action,...}}}
//            Bun plugin returns flat index {'block/ads': {defaultAction,...}}
const _c = catalogIndexData as any
export const catalogIndex = (!_c?.groups ? _c : (() => {
  return Object.fromEntries(Object.entries(_c.groups).map(([gid, d]: [string, any]) => [gid, {
    name:          d.name          || gid,
    description:   d.description   || '',
    defaultAction: d.default_action || 'PROXY',
    tags:          d.tags          || [],
    region:        d.region        || 'any',
    memberCount:   (d.members || []).length,
    members:       d.members       || [],
  }]))
})()) as Record<string, any>

/** Load categories index lazily — fetched from dist/ when Advanced Mode is opened. */
export async function loadCategoriesIndex(): Promise<Record<string, any>> {
  const resp = await fetch('./categories-index.json')
  if (!resp.ok) throw new Error(`Failed to load categories index: ${resp.status}`)
  return resp.json()
}

/** @returns rulesets manifest from build.py */
export async function loadCatalog(): Promise<CatalogManifest> {
  const resp = await fetch(RULESETS_URL)
  if (!resp.ok) throw new Error(`Failed to load catalog: ${resp.status}`)
  return resp.json()
}

/**
 * List available catalog groups from rulesets.json, sorted by group ID.
 */
export function getGroups(catalog: CatalogManifest): Array<{
  id: string; flatName: string; name: string; defaultAction: string; region: string; tags: string[]
}> {
  return Object.entries(catalog.items || {})
    .filter(([, info]: [string, CatalogItem]) => info.kind === 'group')
    .map(([flatName, info]: [string, CatalogItem]) => ({
      id:            info.group_id || flatName,
      flatName,
      name:          info.name || flatName,
      defaultAction: info.default_action || 'PROXY',
      region:        info.region || 'any',
      tags:          info.tags || [],
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ── Proxy group categories (UI grouping) ───────────────────────────────────
// Ordered by typical usage frequency — AI is the most-used service group.
// This order also determines the group order in generated profiles when
// multiple categories are enabled.

export interface GroupCategory {
  id: string
  label: string
  groups: string[]
}

export const GROUP_CATEGORIES: GroupCategory[] = [
  { id: 'ai',         label: '人工智能', groups: ['proxy/ai'] },
  { id: 'messaging',  label: '社交通讯', groups: ['proxy/telegram', 'proxy/twitter', 'proxy/social'] },
  { id: 'streaming',  label: '流媒体',   groups: ['proxy/youtube', 'proxy/netflix', 'proxy/streaming'] },
  { id: 'gaming',     label: '游戏平台', groups: ['proxy/gaming'] },
  { id: 'dev',        label: '开发工具', groups: ['proxy/dev'] },
  { id: 'scholar',    label: '学术教育', groups: ['proxy/scholar'] },
  { id: 'finance',    label: '金融理财', groups: ['proxy/finance'] },
  { id: 'news',       label: '新闻资讯', groups: ['proxy/news'] },
  { id: 'cloud',      label: '云服务',   groups: ['proxy/apple', 'proxy/google', 'proxy/microsoft', 'proxy/amazon'] },
]

/** Which categories are ON for a given preset's group list. */
export function deriveCategoryStates(presetGroups: string[]): Record<string, boolean> {
  const gset = new Set(presetGroups)
  const result: Record<string, boolean> = {}
  for (const cat of GROUP_CATEGORIES) {
    result[cat.id] = cat.groups.some(g => gset.has(g))
  }
  return result
}

/**
 * Merge preset groups with category overrides, preserving category order.
 * Base groups (dns/block/direct/cloud) keep their preset order.
 * Category groups are appended in GROUP_CATEGORIES order (most-used first).
 */
export function applyCategoryOverrides(
  presetGroups: string[],
  overrides: Record<string, boolean>,
): string[] {
  const presetSet = new Set(presetGroups)
  const categoryGroupSet = new Set(GROUP_CATEGORIES.flatMap(c => c.groups))
  // Non-category groups (dns, block, direct, cloud services) — keep preset order
  const baseGroups = presetGroups.filter(g => !categoryGroupSet.has(g))
  // Category groups in defined order
  const catGroups: string[] = []
  for (const cat of GROUP_CATEGORIES) {
    const override = overrides[cat.id]
    const enabled = override !== undefined ? override : cat.groups.some(g => presetSet.has(g))
    if (enabled) catGroups.push(...cat.groups)
  }
  return [...baseGroups, ...catGroups]
}
