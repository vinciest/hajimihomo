// @ts-nocheck
/**
 * Bun plugin: handles YAML imports from profiles/ in four ways:
 *
 * 0. profiles/global-settings.yaml → compileGlobalSettings() → JS object export
 *    { health_url, info_pattern, custom_exclude_pattern }
 *
 * 1. profiles/filter-anchors.yaml → compileFilters() → JS object export
 *    { InfoPattern, FilterInfo, FilterExclude, HighMulPattern, regions, FilterHK, … }
 *
 * 2. profiles/group-anchors.yaml → compileGroupAnchors() → base64 YAML text export
 *    Decoded at runtime with _decode() in ProfileBuilder.
 *
 * 3. profiles/defaults/*.yaml → base64 string export (decoded at runtime).
 *
 * Only .yaml files are affected (.yaml.eta uses the text loader unchanged).
 */
import { load as parseYaml } from 'js-yaml'
import { compileGlobalSettings, compileFilters, compileGroupAnchors, compileRuleProviderAnchors } from '../anchor-builder'

const GLOBAL_SETTINGS_FILTER    = /profiles\/global-settings\.yaml$/
const FILTERS_FILTER           = /profiles\/filter-anchors\.yaml$/
const GROUP_ANCHORS_FILTER     = /profiles\/group-anchors\.yaml$/
const RULE_PROVIDER_FILTER     = /profiles\/rule-provider-anchors\.yaml$/
const SERVICE_GROUPS_FILTER    = /profiles\/service-groups\.yaml$/
const DEFAULTS_FILTER          = /profiles\/defaults\/[^/]+\.yaml$/

export const yamlB64Plugin = {
  name: 'yaml-b64',
  setup(build: any) {
    // global-settings.yaml: compile and emit as JS object export
    // Must load before filter-anchors so globalVars are available.
    let _globalVars: Record<string, string> | undefined
    build.onLoad({ filter: GLOBAL_SETTINGS_FILTER }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const out = compileGlobalSettings(doc)
      _globalVars = {
        'info-pattern':           out.info_pattern,
        'custom-exclude-pattern': out.custom_exclude_pattern,
        'HealthUrl':              out.health_url,
      }
      return { contents: `export default ${JSON.stringify(out)}`, loader: 'js' }
    })

    // filter-anchors.yaml: compile and emit as JS object export (global vars merged)
    build.onLoad({ filter: FILTERS_FILTER }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const out = compileFilters(doc, _globalVars)
      return { contents: `export default ${JSON.stringify(out)}`, loader: 'js' }
    })

    // group-anchors.yaml: compile to YAML text, emit as base64 string export
    build.onLoad({ filter: GROUP_ANCHORS_FILTER }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const text = compileGroupAnchors(doc)
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })

    // rule-provider-anchors.yaml: compile to YAML text, emit as base64 string export
    build.onLoad({ filter: RULE_PROVIDER_FILTER }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const text = compileRuleProviderAnchors(doc)
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })

    // service-groups.yaml: parse and emit as JS object export (same as filter-anchors)
    build.onLoad({ filter: SERVICE_GROUPS_FILTER }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      return { contents: `export default ${JSON.stringify(doc)}`, loader: 'js' }
    })

    // profiles/defaults/*.yaml: emit as base64 string (decoded at runtime)
    build.onLoad({ filter: DEFAULTS_FILTER }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })
  },
}
