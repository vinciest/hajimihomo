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
export const presets = (presetsData as Record<string, any>)

/** @deprecated Use the presets export directly — kept for backwards compat. */
export function loadPresets() { return presets }

/** Catalog group metadata bundled at build time — keyed by group ID. */
export const catalogIndex = catalogIndexData

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
