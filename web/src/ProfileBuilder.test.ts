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

describe('4-tier proxy group structure (P9)', () => {
  const GROUPS_4T = ['proxy/telegram', 'proxy/ai', 'block/ads', 'block/tracking', 'direct/cn']

  test('regional topology has strategy groups', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names).toContain('香港策略')
    expect(names).toContain('美国策略')
  })

  test('Tier 4 leaf groups are hidden', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const leafGroups = parsed['proxy-groups'].filter((g: any) =>
      g.name.endsWith('高速') || g.name.endsWith('可用')
    )
    expect(leafGroups.length).toBeGreaterThan(0)
    for (const g of leafGroups) {
      expect(g.hidden).toBe(true)
    }
  })

  test('service groups reference 策略-suffixed region names', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const telegramGroup = parsed['proxy-groups'].find((g: any) => g.name === '电报消息')
    expect(telegramGroup).toBeTruthy()
    expect(telegramGroup.proxies.some((p: string) => p.endsWith('策略'))).toBe(true)
  })

  test('service groups use Chinese display names', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names).toContain('电报消息')
    // No old English names
    expect(names).not.toContain('Telegram')
  })

  test('advanced topology has LB groups', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'advanced', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names.some((n: string) => n.endsWith('均衡-散列'))).toBe(true)
    expect(names.some((n: string) => n.endsWith('均衡-轮询'))).toBe(true)
  })

  test('smart kernel uses smart type for leaf groups', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo-smart',
    })
    const parsed = parseYaml(out) as any
    const leafGroups = parsed['proxy-groups'].filter((g: any) => g.name.endsWith('高速'))
    expect(leafGroups.length).toBeGreaterThan(0)
    for (const g of leafGroups) {
      expect(g.type).toBe('smart')
    }
  })

  test('global topology has no strategy groups', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'global', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names.every((n: string) => !n.endsWith('策略'))).toBe(true)
  })

  test('Proxy group has include-all in regional topology', () => {
    const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const proxyGroup = parsed['proxy-groups'].find((g: any) => g.name === 'Proxy')
    expect(proxyGroup).toBeTruthy()
    expect(proxyGroup['include-all']).toBe(true)
  })

  test('no 默认代理 or 直接连接 groups in any topology', () => {
    for (const topology of ['global', 'regional', 'advanced'] as const) {
      const out = buildFullProfile(SUBS, GROUPS_4T, catalog, {
        topology, target: 'mihomo',
      })
      const parsed = parseYaml(out) as any
      const names = parsed['proxy-groups'].map((g: any) => g.name)
      expect(names).not.toContain('默认代理')
      expect(names).not.toContain('直接连接')
    }
  })
})

describe('P10-P12 improvements', () => {
  const GROUPS = ['proxy/telegram', 'proxy/ai', 'block/ads', 'block/tracking', 'direct/cn']

  test('漏网之鱼 has fish emoji in group name and MATCH rule', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names).toContain('🐟 漏网之鱼')
    const rules = parsed['rules'] as string[]
    expect(rules[rules.length - 1]).toBe('MATCH,🐟 漏网之鱼')
  })

  test('block groups have icons', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const adsGroup = parsed['proxy-groups'].find((g: any) => g.name === '🚫 广告拦截')
    expect(adsGroup?.icon).toBeTruthy()
  })

  test('Fast and Available shortcut groups exist in regional topology', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names).toContain('Fast')
    expect(names).toContain('Available')
  })

  test('Fast and Available not present in global topology', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'global', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const names = parsed['proxy-groups'].map((g: any) => g.name)
    expect(names).not.toContain('Fast')
    expect(names).not.toContain('Available')
  })

  test('Proxy icon uses Orz-3 Vpn.png', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const proxyGroup = parsed['proxy-groups'].find((g: any) => g.name === 'Proxy')
    expect(proxyGroup?.icon).toContain('Vpn.png')
  })

  test('service groups use <<: *GroupSelectXX anchor refs in raw output', () => {
    const out = buildFullProfile(SUBS, ['proxy/telegram', 'proxy/ai', 'direct/cn'], catalog, {
      topology: 'regional', target: 'mihomo',
    })
    expect(out).toContain('<<: *GroupSelectHK')
    expect(out).toContain('<<: *GroupSelectUS')
  })

  test('telegram group (anchor-default) has no explicit proxies in raw output', () => {
    const out = buildFullProfile(SUBS, ['proxy/telegram', 'direct/cn'], catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const lines = out.split('\n')
    const nameIdx = lines.findIndex(l => l.includes('电报消息'))
    if (nameIdx >= 0) {
      // find the next group start (next '  - name:' line)
      const nextGroupIdx = lines.findIndex((l, i) => i > nameIdx && /^\s{2}- name:/.test(l))
      const end = nextGroupIdx > 0 ? nextGroupIdx : nameIdx + 10
      const block = lines.slice(nameIdx, end).join('\n')
      expect(block).not.toMatch(/proxies:/)
    }
  })

  test('filter anchor refs appear in leaf groups (not inline regex)', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    expect(out).toContain('&FilterHK')
    expect(out).toContain('filter: *FilterHK')
  })

  test('anchor block contains FilterInfo and RegexHighMul', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    expect(out).toContain('&FilterInfo')
    expect(out).toContain('&RegexHighMul')
  })

  test('HEALTH_URL appears in anchor block', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    expect(out).toContain('cp.cloudflare.com/generate_204')
  })

  test('proxy-provider filter uses same junk-exclude pattern', () => {
    const out = buildFullProfile(SUBS, GROUPS, catalog, {
      topology: 'regional', target: 'mihomo',
    })
    expect(out).toContain('&ProxyProvider')
    expect(out).toContain('filter:')
  })

  test('telegram group after YAML parse has include-all true (from anchor merge)', () => {
    const out = buildFullProfile(SUBS, ['proxy/telegram', 'direct/cn'], catalog, {
      topology: 'regional', target: 'mihomo',
    })
    const parsed = parseYaml(out) as any
    const tg = parsed['proxy-groups'].find((g: any) => g.name === '电报消息')
    expect(tg?.['include-all']).toBe(true)
  })
})
