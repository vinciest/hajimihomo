/**
 * ProfileBuilder.test.ts — regression tests for the generation engine.
 *
 * Run: bun test web/src/ProfileBuilder.test.ts
 *
 * Uses js-yaml (devDep) to validate that generated output is parseable YAML
 * and has the expected structure.
 */
import { describe, test, expect, beforeAll } from 'bun:test'
import { load as parseYaml } from 'js-yaml'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildFullProfile, buildProfileFromCustomGroups, buildRuleProviders, buildMihomoGroups } from './ProfileBuilder'
import type { CatalogManifest, CustomGroup } from './types'

const root = resolve(import.meta.dir, '../..')

// Load a real rulesets.json produced by the build pipeline
const catalog: CatalogManifest = JSON.parse(
  readFileSync(resolve(root, 'dist/rulesets.json'), 'utf8')
)

const SUBS = ['https://example.com/sub?token=test']
const GROUP_IDS = ['proxy/telegram', 'block/ads', 'direct/cn']

// Filter to only group-kind items that actually exist in catalog
const availableGroups = GROUP_IDS.filter(id => {
  const flat = id.replace('/', '-')
  return Object.values(catalog.items || {}).some(
    (item: any) => item.group_id === id || item.group_id === flat
  )
})

describe('buildFullProfile', () => {
  let output: string
  let parsed: any

  beforeAll(() => {
    output = buildFullProfile(SUBS, availableGroups, catalog, {
      topology: 'regional',
      target: 'mihomo',
      geodata: 'metacubex',
      format: 'yaml-split',
    })
  })

  test('produces non-empty string', () => {
    expect(output.length).toBeGreaterThan(1000)
  })

  test('is valid YAML', () => {
    expect(() => { parsed = parseYaml(output) }).not.toThrow()
    expect(parsed).toBeTruthy()
  })

  test('has required top-level keys', () => {
    expect(parsed).toHaveProperty('proxy-providers')
    expect(parsed).toHaveProperty('proxy-groups')
    expect(parsed).toHaveProperty('rule-providers')
    expect(parsed).toHaveProperty('rules')
  })

  test('proxy-providers contains subscription entries', () => {
    const providers = parsed['proxy-providers'] as Record<string, any>
    const entries = Object.values(providers).filter((p: any) => p.url)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect((entries[0] as any).url).toBe(SUBS[0])
  })

  test('proxy-groups is a non-empty array', () => {
    expect(Array.isArray(parsed['proxy-groups'])).toBe(true)
    expect(parsed['proxy-groups'].length).toBeGreaterThan(0)
  })

  test('rules ends with MATCH fallback', () => {
    const rules = parsed['rules'] as string[]
    expect(Array.isArray(rules)).toBe(true)
    const last = rules[rules.length - 1]
    expect(last).toMatch(/^MATCH,/)
  })

  test('anchors survive in raw output (not mangled by yaml.dump)', () => {
    expect(output).toContain('&ProxyProvider')
    expect(output).toContain('<<: *ProxyProvider')
  })

  test('multiple subs produce multiple provider entries', () => {
    const multi = buildFullProfile(
      [...SUBS, 'https://example2.com/sub'],
      availableGroups,
      catalog,
      { topology: 'regional', target: 'mihomo' }
    )
    const mp = parseYaml(multi) as any
    const entries = Object.values(mp['proxy-providers'] || {}).filter((p: any) => p.url)
    expect(entries.length).toBeGreaterThanOrEqual(2)
  })
})

describe('buildFullProfile — targets', () => {
  test('mihomo-smart target includes smart group type in output', () => {
    const out = buildFullProfile(SUBS, availableGroups, catalog, {
      topology: 'regional',
      target: 'mihomo-smart',
    })
    expect(out).toContain('type: smart')
  })

  test('singbox target produces valid YAML output', () => {
    const out = buildFullProfile(SUBS, availableGroups, catalog, {
      topology: 'regional',
      target: 'singbox',
    })
    expect(out.length).toBeGreaterThan(100)
    // singbox target still uses mihomo structure with singbox-specific rule-set entries
    let parsed: any
    expect(() => { parsed = parseYaml(out) }).not.toThrow()
    expect(parsed).toHaveProperty('rules')
  })
})

describe('buildProfileFromCustomGroups', () => {
  const customGroups: CustomGroup[] = [
    {
      name: 'My Proxy',
      action: 'PROXY',
      members: [{ type: 'group', id: availableGroups[0] || 'proxy/telegram', label: 'Telegram' }],
    },
  ]

  test('produces valid YAML with custom groups', () => {
    const out = buildProfileFromCustomGroups(SUBS, customGroups, catalog)
    let parsed: any
    expect(() => { parsed = parseYaml(out) }).not.toThrow()
    expect(parsed).toHaveProperty('rules')
  })
})

describe('buildRuleProviders', () => {
  test('returns rule-provider entries for requested groups', () => {
    const providers = buildRuleProviders(availableGroups, catalog)
    expect(typeof providers).toBe('object')
    expect(Object.keys(providers).length).toBeGreaterThan(0)
  })
})

describe('buildMihomoGroups', () => {
  test('returns object with groups array', () => {
    const result = buildMihomoGroups(SUBS, availableGroups, catalog)
    expect(typeof result).toBe('object')
    expect(Array.isArray(result.groups)).toBe(true)
    expect(result.groups.length).toBeGreaterThan(0)
    expect(result.groups[0]).toHaveProperty('name')
    expect(result.groups[0]).toHaveProperty('type')
  })
})
