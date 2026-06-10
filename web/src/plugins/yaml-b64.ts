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
import { resolve, dirname } from 'node:path'
import { compileGlobalSettings, compileFilters, compileGroupAnchors, compileRuleProviderAnchors } from '../anchor-builder'

const GLOBAL_SETTINGS_FILTER    = /profiles\/global-settings\.yaml$/
const FILTERS_FILTER           = /profiles\/filter-anchors\.yaml$/
const GROUP_ANCHORS_FILTER     = /profiles\/group-anchors\.yaml$/
const RULE_PROVIDER_FILTER     = /profiles\/rule-provider-anchors\.yaml$/
const SERVICE_GROUPS_FILTER    = /profiles\/service-groups\.yaml$/
const DEFAULTS_FILTER          = /profiles\/defaults\/[^/]+\.yaml$/

const NAMESPACE = 'yaml-b64'

export const yamlB64Plugin = {
  name: 'yaml-b64',
  setup(build: any) {
    // Use onResolve + custom namespace to force precedence over Bun's native YAML loader.
    // Without this, Bun 1.3+ may bypass our onLoad handlers entirely.
    const _resolve = ({ importer, path }: any) => ({ namespace: NAMESPACE, path: resolve(dirname(importer ?? process.cwd()), path) })
    build.onResolve({ filter: GLOBAL_SETTINGS_FILTER },  _resolve)
    build.onResolve({ filter: FILTERS_FILTER },           _resolve)
    build.onResolve({ filter: GROUP_ANCHORS_FILTER },     _resolve)
    build.onResolve({ filter: RULE_PROVIDER_FILTER },     _resolve)
    build.onResolve({ filter: SERVICE_GROUPS_FILTER },    _resolve)
    build.onResolve({ filter: DEFAULTS_FILTER },          _resolve)

    // global-settings.yaml: compile and emit as JS object export
    // Must load before filter-anchors so globalVars are available.
    let _globalVars: Record<string, string> | undefined
    build.onLoad({ filter: GLOBAL_SETTINGS_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
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
    // If globalVars aren't set yet (Bun.build may load in any order), compile
    // global-settings inline using the sibling path.
    build.onLoad({ filter: FILTERS_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
      if (!_globalVars) {
        const gsPath = path.replace(/filter-anchors\.yaml$/, 'global-settings.yaml')
        try {
          const gsDoc = parseYaml(await Bun.file(gsPath).text())
          const gs = compileGlobalSettings(gsDoc)
          _globalVars = {
            'info-pattern':           gs.info_pattern,
            'custom-exclude-pattern': gs.custom_exclude_pattern,
            'HealthUrl':              gs.health_url,
          }
        } catch { /* global-settings not found at sibling path — leave _globalVars undefined */ }
      }
      const doc = parseYaml(await Bun.file(path).text())
      const out = compileFilters(doc, _globalVars)
      return { contents: `export default ${JSON.stringify(out)}`, loader: 'js' }
    })

    // group-anchors.yaml: compile to YAML text, emit as base64 string export
    build.onLoad({ filter: GROUP_ANCHORS_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const text = compileGroupAnchors(doc)
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })

    // rule-provider-anchors.yaml: compile to YAML text, emit as base64 string export
    build.onLoad({ filter: RULE_PROVIDER_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      const text = compileRuleProviderAnchors(doc)
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })

    // service-groups.yaml: parse and emit as JS object export (same as filter-anchors)
    build.onLoad({ filter: SERVICE_GROUPS_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
      const doc = parseYaml(await Bun.file(path).text())
      return { contents: `export default ${JSON.stringify(doc)}`, loader: 'js' }
    })

    // profiles/defaults/*.yaml: emit as base64 string (decoded at runtime)
    build.onLoad({ filter: DEFAULTS_FILTER, namespace: NAMESPACE }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      return { contents: `export default ${JSON.stringify(b64)}`, loader: 'js' }
    })
  },
}
