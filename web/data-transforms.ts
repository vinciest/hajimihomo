/**
 * data-transforms.ts — pure functions to transform source YAML into bundled data.
 * No file I/O, no side effects. Used by the Bun plugin (build/dev) and gen-data.ts.
 */
import { load as parseYaml } from 'js-yaml'

export function buildPresetsIndex(presetsYaml: string): Record<string, any> {
  const presetsMap = ((parseYaml(presetsYaml) as any)?.presets || {}) as Record<string, any>
  const result: Record<string, any> = {}
  for (const [name, data] of Object.entries(presetsMap)) {
    const d = data as any
    result[name] = {
      label:       d.label       || name,
      description: d.description || '',
      target:      d.target      || 'mihomo',
      topology:    d.topology    || 'regional',
      features:    d.features    || {},
      groups:      d.groups      || [],
    }
  }
  return result
}

export function buildCatalogIndex(catalogYaml: string): Record<string, any> {
  const catGrp = ((parseYaml(catalogYaml) as any)?.groups || {}) as Record<string, any>
  const result: Record<string, any> = {}
  for (const [gid, gdata] of Object.entries(catGrp)) {
    const d = gdata as any
    result[gid] = {
      name:          d.name          || gid,
      description:   d.description   || '',
      defaultAction: d.default_action || 'PROXY',
      tags:          d.tags          || [],
      region:        d.region        || 'any',
      memberCount:   (d.members || []).length,
      members:       d.members       || [],
    }
  }
  return result
}

export function buildCategoriesIndex(categoriesYaml: string, catalogYaml: string): Record<string, any> {
  const cats   = parseYaml(categoriesYaml) as Record<string, any>
  const catGrp = ((parseYaml(catalogYaml) as any)?.groups || {}) as Record<string, any>
  const catToGroups: Record<string, string[]> = {}
  for (const [gid, gdata] of Object.entries(catGrp)) {
    for (const member of (gdata as any).members || []) {
      (catToGroups[member] = catToGroups[member] || []).push(gid)
    }
  }
  const result: Record<string, any> = {}
  for (const [name, data] of Object.entries(cats)) {
    if (typeof data !== 'object' || data === null) continue
    result[name] = {
      type:   (data as any).type || 'unknown',
      groups: catToGroups[name] || [],
    }
  }
  return result
}
