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
