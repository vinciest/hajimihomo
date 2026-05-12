// @ts-nocheck
/**
 * Bun plugin: handles YAML imports from profiles/ in two ways:
 *
 * 1. profiles/filters.yaml → parses and emits all filter/regex data as a JS export:
 *    { InfoPattern, FilterInfo, HighMulPattern, regions, FilterHK, FilterTW, ... }
 *    FilterXX shortcuts are derived from regions[].filter keyed by Filter<key>.
 *
 * 2. profiles/defaults/*.yaml → base64-encodes and emits as a string export,
 *    safe for minification. Decoded at runtime with _decode() in ProfileBuilder.
 *
 * Only .yaml files are affected (.yaml.eta uses the text loader unchanged).
 */
import { load as parseYaml } from 'js-yaml'

const FILTERS_FILTER = /profiles\/filters\.yaml$/
const DEFAULTS_FILTER = /profiles\/defaults\/[^/]+\.yaml$/

export const yamlB64Plugin = {
  name: 'yaml-b64',
  setup(build: any) {
    // filters.yaml: parse and emit all regex data as a JS export
    build.onLoad({ filter: FILTERS_FILTER }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      const doc = parseYaml(text) as any
      const regions = (doc?.regions ?? []) as Array<{
        name: string; key: string; pattern: string; filter: string
      }>
      // Spread FilterXX shortcuts alongside the structured data
      const filterShortcuts = Object.fromEntries(
        regions.map(r => [`Filter${r.key}`, r.filter])
      )
      const out = {
        InfoPattern: doc?.InfoPattern ?? '',
        FilterInfo: doc?.FilterInfo ?? '',
        HighMulPattern: doc?.HighMulPattern ?? '',
        regions,
        ...filterShortcuts,
      }
      return { contents: `export default ${JSON.stringify(out)}`, loader: 'js' }
    })

    // profiles/defaults/*.yaml: emit as base64 string (decoded at runtime)
    build.onLoad({ filter: DEFAULTS_FILTER }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })
  },
}

