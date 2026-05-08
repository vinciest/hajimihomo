/**
 * Data layer — presets, catalog index, category index, rulesets manifest.
 *
 * Separated from ProfileBuilder.js so the generation engine has no dependency
 * on data loading, and any UI implementation can import data independently.
 */

import yaml from 'js-yaml'
import presetsText      from '../../profiles/presets.yaml'          with { type: 'text' }
import catalogIndexData  from './data/catalog-index.json'
import categoriesIndexData from './data/categories-index.json'
import { RULESETS_URL }  from './constants.js'

/** Presets bundled at build time from profiles/presets.yaml — no fetch needed. */
export const presets = (() => {
  const data = yaml.load(presetsText) || {}
  return data.presets || {}
})()

/** @deprecated Use the presets export directly — kept for backwards compat. */
export function loadPresets() { return presets }

/** Catalog group metadata bundled at build time — keyed by group ID. */
export const catalogIndex = catalogIndexData

/** Category metadata bundled at build time — keyed by category name. */
export const categoriesIndex = categoriesIndexData

/** @returns {Promise<Object>} rulesets manifest from build.py */
export async function loadCatalog() {
  const resp = await fetch(RULESETS_URL)
  if (!resp.ok) throw new Error(`Failed to load catalog: ${resp.status}`)
  return resp.json()
}

/**
 * List available catalog groups from rulesets.json, sorted by group ID.
 * @param {Object} catalog — from loadCatalog()
 * @returns {{ id, flatName, name, defaultAction, region, tags }[]}
 */
export function getGroups(catalog) {
  return Object.entries(catalog.items || {})
    .filter(([, info]) => info.kind === 'group')
    .map(([flatName, info]) => ({
      id:            info.group_id,
      flatName,
      name:          info.name || flatName,
      defaultAction: info.default_action || 'PROXY',
      region:        info.region || 'any',
      tags:          info.tags || [],
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
