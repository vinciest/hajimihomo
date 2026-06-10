// @ts-nocheck
// Internal functions use untyped JS patterns — exported signatures are typed below.
// Adding full types to this complex generation engine risks introducing bugs.

import type { CatalogManifest, ProfileOptions, CustomGroup } from './types'

/**
 * Profile generation engine.
 *
 * Pure functions — no DOM, no data fetching.
 * Data layer lives in catalog.js; UI wiring in main.js.
 */

import { Eta } from 'eta'
import coreTmpl          from './templates/core.yaml.eta'             with { type: 'text' }
import geodataTmpl       from './templates/geodata.yaml.eta'          with { type: 'text' }
import profileTmpl       from './templates/profile.yaml.eta'          with { type: 'text' }
import proxyProviderAnchorsTmpl    from './templates/proxy-provider-anchors.yaml.eta'      with { type: 'text' }
import proxyGroupRegionAnchorsTmpl from './templates/proxy-group-region-anchors.yaml.eta'  with { type: 'text' }
import _dnsB64                    from '../../profiles/defaults/dns.yaml'
import _snifferB64                from '../../profiles/defaults/sniffer.yaml'
import _tunB64                    from '../../profiles/defaults/tun.yaml'
import _ruleProviderAnchorsB64    from '../../profiles/rule-provider-anchors.yaml'
import _proxyGroupStrategyB64     from '../../profiles/group-anchors.yaml'
import yaml from 'js-yaml'
import { compileGroupAnchors, compileRuleProviderAnchors, compileFilters, compileGlobalSettings } from './anchor-builder'
import dnsTmpl from '../../profiles/defaults/dns.yaml.eta' with { type: 'text' }
import snifferTmpl from '../../profiles/defaults/sniffer.yaml.eta' with { type: 'text' }
import filtersData                from '../../profiles/filter-anchors.yaml'
import serviceGroupsData          from '../../profiles/service-groups.yaml'
import globalSettingsData         from '../../profiles/global-settings.yaml'
import {
  CDN_BASE, RELEASES_BASE, RULESETS_URL,
  SPLIT_ORDER, SPLIT_BEHAVIOR,
  GEODATA_SOURCES,
  ICON_BASE, ORZ3_BASE,
  RULE_INTERVAL,
} from './constants'

const DNS_DEFAULTS = {
  default_nameserver: ['223.5.5.5', '119.29.29.29'],
  nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
  fallback: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query', 'https://9.9.9.9/dns-query'],
  nameserver_policy: [] as Array<{ domain: string; servers: string[] }>,
}

/** UTF-8-safe base64 decode — works in both browser (TextDecoder) and Node/Bun (Buffer). */
function _decode(b) {
  if (typeof b !== 'string') return yaml.dump(b, { lineWidth: -1, noRefs: true })
  if (typeof Buffer !== 'undefined') return Buffer.from(b, 'base64').toString('utf8')
  return new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0)))
}

// Decoded YAML text blobs (lazily decoded on first access via module-level const is fine —
// called only during profile generation, not at module load time in tests).
const _dns     = () => _decode(_dnsB64)
const _sniffer = () => _decode(_snifferB64)
const _tun     = () => _decode(_tunB64)
const _ruleProviderAnchors    = () => typeof _ruleProviderAnchorsB64 === 'string' ? _decode(_ruleProviderAnchorsB64) : compileRuleProviderAnchors(_ruleProviderAnchorsB64)
const _proxyGroupStrategyAnchors = () => typeof _proxyGroupStrategyB64 === 'string' ? _decode(_proxyGroupStrategyB64) : compileGroupAnchors(_proxyGroupStrategyB64)

const _eta = new Eta({ autoEscape: false, autoTrim: false })

// ── Service groups data (from profiles/service-groups.yaml) ─────────────────
const _sgById    = new Map((serviceGroupsData.groups as any[]).map(g => [g.id, g]))
const _DIRECT_GROUPS = new Set(
  (serviceGroupsData.groups as any[]).filter(g => !g.anchor && g.proxies?.[0] === 'DIRECT').map(g => g.id)
)
const _REJECT_GROUPS = new Set(
  (serviceGroupsData.groups as any[]).filter(g => g.proxies?.[0] === 'REJECT').map(g => g.id)
)

const _pluginActive = 'regions' in filtersData
const _compiled = _pluginActive ? filtersData : compileFilters(filtersData, {
  'info-pattern':           (globalSettingsData as any).info_pattern ?? '',
  'custom-exclude-pattern': (globalSettingsData as any).custom_exclude_pattern ?? '',
  'HealthUrl':              (globalSettingsData as any).health_url ?? '',
})
const _REGIONS = _compiled.regions
const _F = _compiled

/**
 * Build mihomo rule-providers + ordered rules for selected catalog groups.
 *
 * @param {string[]} groupIds — catalog group IDs (e.g. ['proxy/telegram', 'block/ads'])
 * @param {Object}   catalog  — from loadCatalog()
 * @param {{tier?: number}} options  — tier 1 (default) or 2
 * @returns {{ providers: Object, rules: string[] }}
 */
export function buildRuleProviders(groupIds: string[], catalog: CatalogManifest, { tier = 1 }: { tier?: number } = {}) {
  const providers = {}
  // Global type buckets — CRITICAL for correct cross-group ordering.
  // Per-group ordering (domain→residual→process→ip per group) is WRONG:
  //   direct-cn-process would precede proxy-telegram-domain, letting process
  //   rules shadow domain policy from later groups.
  // Correct order: ALL .domain → ALL .residual → ALL .process → ALL .ip →
  //                ALL .ip-resolve (LAST — triggers DNS).
  const buckets = { domain: [], residual: [], process: [], ip: [], 'ip-resolve': [] }

  for (const gid of groupIds) {
    const flatName = gid.replace(/\//g, '-')
    const info = (catalog.items || {})[flatName]
    if (!info) continue

    const action       = info.default_action || 'PROXY'
    const mihomoSplits = info.targets?.mihomo?.splits || []
    const useSplits    = tier >= 2 && mihomoSplits.length > 0

    if (!useSplits) {
      // Tier 1: all-in-one classical — goes in domain bucket (first phase)
      providers[flatName] = _provider(flatName, `${flatName}.yaml`, info.behavior || 'classical')
      buckets.domain.push(`RULE-SET,${flatName},${action}`)
    } else {
      // Tier 2: place each split in its global type bucket
      for (const split of [...SPLIT_ORDER, 'ip-resolve']) {
        if (!mihomoSplits.includes(split)) continue
        const key = `${flatName}-${split}`
        providers[key] = _provider(key, `${flatName}.${split}.yaml`, SPLIT_BEHAVIOR[split] || 'ipcidr')
        buckets[split].push(split === 'ip'
          ? `RULE-SET,${key},${action},no-resolve`
          : `RULE-SET,${key},${action}`)
      }
    }
  }

  return {
    providers,
    rules: [
      ...buckets.domain,
      ...buckets.residual,
      ...buckets.process,
      ...buckets.ip,
      ...buckets['ip-resolve'],  // must be absolute last — triggers DNS
    ],
  }
}

function _provider(name, filename, behavior) {
  return {
    type:     'http',
    behavior,
    url:      `${CDN_BASE}@ruleset/mihomo/${filename}`,
    path:     `./ruleset/${filename}`,
    interval: RULE_INTERVAL,
    format:   'yaml',
  }
}

/**
 * Build sing-box route rule_set entries for selected catalog groups.
 * Tier 1: {flatName}.json   Tier 2: {flatName}.{split}.json
 * No ip-resolve split — sing-box has no no-resolve concept; .ip covers all IP-CIDR.
 *
 * @returns {{ ruleSets: Object[], routeRules: Object[] }}
 */
export function buildSingboxRuleSets(groupIds: string[], catalog: CatalogManifest, { tier = 1 }: { tier?: number } = {}) {
  const ruleSets = []
  // Same global bucket pattern as buildRuleProviders — process must follow all domain.
  // sing-box has no no-resolve; ip-resolve bucket stays empty but is kept for symmetry.
  const buckets = { domain: [], residual: [], process: [], ip: [], 'ip-resolve': [] }

  for (const gid of groupIds) {
    const flatName = gid.replace(/\//g, '-')
    const info = (catalog.items || {})[flatName]
    if (!info) continue

    const action   = info.default_action || 'PROXY'
    const outbound = action === 'REJECT' ? 'block' : action.toLowerCase()
    const sbSplits = info.targets?.singbox?.splits || []
    const useSplits = tier >= 2 && sbSplits.length > 0

    if (!useSplits) {
      const tag = `ruleset-${flatName}`
      ruleSets.push(_sbRuleSet(tag, `singbox/${flatName}.json`))
      buckets.domain.push({ rule_set: tag, outbound })
    } else {
      for (const split of SPLIT_ORDER) {
        if (!sbSplits.includes(split)) continue
        const tag = `ruleset-${flatName}-${split}`
        ruleSets.push(_sbRuleSet(tag, `singbox/${flatName}.${split}.json`))
        buckets[split].push({ rule_set: tag, outbound })
      }
    }
  }

  const routeRules = [
    ...buckets.domain,
    ...buckets.residual,
    ...buckets.process,
    ...buckets.ip,
  ]
  return { ruleSets, routeRules }
}

function _sbRuleSet(tag, path) {
  return {
    tag,
    type:             'remote',
    format:           'source',
    url:              `${CDN_BASE}@ruleset/${path}`,
    download_detour:  'proxy',
    update_interval:  '1d',
  }
}

/**
 * Assemble a mihomo config fragment: proxy-providers, proxy-groups, rule-providers, rules.
 *
 * @param {string[]} subUrls  — subscription URLs
 * @param {string[]} groupIds — selected catalog group IDs
 * @param {Object}   catalog
 * @param {{tier?: number}} options
 * @returns {{ proxyProviders, groups, providers, rules }}
 */
export function buildMihomoGroups(subUrls: string[], groupIds: string[], catalog: CatalogManifest, { tier = 1 }: { tier?: number } = {}) {
  const providerNames = subUrls.map((_, i) => `sub-${i + 1}`)
  const proxyProviders = {}
  subUrls.forEach((url, i) => {
    proxyProviders[`sub-${i + 1}`] = {
      type: 'http',
      url,
      interval: 3600,
      health_check: { enable: true, url: 'https://cp.cloudflare.com', interval: 300 },
    }
  })

  const groups = [
    { name: 'PROXY',  type: 'select',   use: providerNames, proxies: ['AUTO', 'DIRECT'] },
    { name: 'AUTO',   type: 'url-test', use: providerNames,
      url: 'https://cp.cloudflare.com', interval: 300, tolerance: 50 },
    { name: 'DIRECT', type: 'select',   proxies: ['DIRECT'] },
    { name: 'REJECT', type: 'select',   proxies: ['REJECT'] },
  ]

  const { providers, rules } = buildRuleProviders(groupIds, catalog, { tier })
  return { proxyProviders, groups, providers, rules }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE PROFILE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function _slug2(gid) { return gid.replace(/\//g, '-') }
function _autoType(target) { return target === 'mihomo-smart' ? 'smart' : 'url-test' }
function _regionFilter(pattern, exclude) {
  const neg = exclude ? `(?!.*(${exclude}))` : ''
  return `^(?=.*(?i)(${pattern}))${neg}.*$`
}

/** Render an eta template string and trim trailing whitespace. */
function _tmpl(template, data) { return _eta.renderString(template, data).trimEnd() }

/** Filter regex WITHOUT user regionExcludes — for anchor block definitions. */
function _regionFilterValue(pattern) {
  return `^(?=.*(?i)(${pattern})).*$`
}

/** Build eta template context for proxy-group-anchors.yaml.eta. */
function _proxyGroupAnchorCtx(topology, target) {
  const leafSuffixes = topology === 'advanced'
    ? ['高速', '可用', '均衡-散列']
    : ['高速', '可用']
  return {
    filterNotify: _F.FilterNotify,
    smart: target === 'mihomo-smart',
    regions: topology === 'global' ? [] : _REGIONS.map(r => {
      return {
        name: r.name,
        key: r.key,
        filterValue: _F[`Filter${r.key}`] || _regionFilterValue(r.pattern ?? ''),
        proxies: [
          ...leafSuffixes.map(s => `${r.name}${s}`),
          ..._REGIONS.filter(rr => rr.key !== r.key).map(rr => `${rr.name}策略`),
          'Proxy', 'DIRECT',
        ],
      }
    }),
    allRegionStrategies: _REGIONS.map(r => `${r.name}策略`),
  }
}

function _buildProxyGroups(groupIds, { topology, target, features, regionExcludes }) {
  const groups = []
  const autoType = _autoType(target)
  const strategyNames = _REGIONS.map(r => `${r.name}策略`)
  const rejectGroups  = groupIds.filter(g => _REJECT_GROUPS.has(g))
  const serviceGroups = groupIds.filter(g => !_DIRECT_GROUPS.has(g) && !_REJECT_GROUPS.has(g))

  // Valid leaf/strategy names for the current topology (used to filter preferred lists)
  const leafSuffixes = topology === 'advanced'
    ? ['高速', '可用', '均衡-散列', '均衡-轮询'] : ['高速', '可用']
  const allLeafNames = _REGIONS.flatMap(r => leafSuffixes.map(s => `${r.name}${s}`))
  const valid = new Set([...strategyNames, ...allLeafNames, 'Proxy', 'DIRECT'])

  // Whether to use filter anchor refs (only when no user regionExcludes)
  const useFilterAnchors = !regionExcludes

  // ── 通知公告 ──────────────────────────────────────────────────────────────
  groups.push({
    name: '通知公告',
    type: 'select',
    'include-all': true,
    filter: '*FilterNotify',
    icon: `https://fastly.jsdelivr.net/gh/hfg-gmuend/openmoji@15.1.0/color/svg/1F4E2.svg`,
  })

  // ── Tier 1: Proxy ─────────────────────────────────────────────────────────
  if (topology === 'global') {
    groups.push({
      name: 'Proxy', type: 'select',
      proxies: ['全部', 'DIRECT'],
      icon: `${ORZ3_BASE}/Vpn.png`,
    })
  } else {
    groups.push({
      name: 'Proxy', type: 'select',
      proxies: strategyNames,
      'include-all': true,
      'exclude-filter': '*FilterNotify',
      icon: `${ORZ3_BASE}/Vpn.png`,
    })
  }

  // ── Cross-region shortcuts (Tier 1.5, optional) ───────────────────────────
  if (topology !== 'global') {
    groups.push({
      name: 'Fast',
      type: 'select',
      proxies: _REGIONS.map(r => `${r.name}高速`),
      icon: `${ORZ3_BASE}/Urltest.png`,
    })
    groups.push({
      name: 'Available',
      type: 'select',
      proxies: _REGIONS.map(r => `${r.name}可用`),
      icon: `${ORZ3_BASE}/Available.png`,
    })
  }

  // ── Block groups (deferred — pushed after regional groups for readability) ──
  const _deferredBlock: any[] = []
  for (const gid of rejectGroups) {
    const sg = _sgById.get(gid)
    const name = sg?.name ?? `🚫 ${gid.split('/')[1]}`
    const g: any = { name, type: 'select', proxies: ['REJECT', 'DIRECT'] }
    if (sg?.icon) g.icon = sg.icon
    _deferredBlock.push(g)
  }
  if (features?.quic_block)
    _deferredBlock.push({ name: '🛡️ 协议拦截', type: 'select', proxies: ['REJECT', 'DIRECT'], icon: `${ICON_BASE}/Reject.png` })

  // ── Service groups (Tier 2) ────────────────────────────────────────────────
  const effectiveMap = {}
  for (const gid of serviceGroups) {
    const sg = _sgById.get(gid)
    const displayName = sg?.name ?? `🌐 ${gid.split('/')[1]}`
    const anchorKey   = sg?.anchor ?? null
    const preferred   = sg?.proxies ?? null  // null = anchor default; array = override

    let g: any

    if (anchorKey && topology !== 'global') {
      // P12: emit <<: *GroupSelectXX anchor reference
      g = { name: displayName, _anchorRef: `GroupSelect${anchorKey}` }
      if (preferred !== null && preferred.length > 0) {
        // Explicit proxies override — filter by topology-valid names
        const proxies = preferred.filter(p => valid.has(p))
        if (!proxies.includes('Proxy')) proxies.push('Proxy')
        if (!proxies.includes('DIRECT')) proxies.push('DIRECT')
        g.proxies = proxies
      }
      // else: anchor default proxies, don't emit proxies
    } else {
      // No anchor: explicit type:select + proxies
      g = { name: displayName, type: 'select' }
      if (topology !== 'global') {
        const arr = (preferred ?? [])
        const proxies = arr.filter(p => valid.has(p))
        if (!proxies.includes('Proxy')) proxies.push('Proxy')
        if (!proxies.includes('DIRECT')) proxies.push('DIRECT')
        g.proxies = proxies
      } else {
        g.proxies = ['Proxy', 'DIRECT']
      }
    }

    if (sg?.icon) g.icon = sg.icon
    if (sg?.filter) g.filter = sg.filter
    effectiveMap[gid] = [displayName, g.proxies?.[0] ?? displayName]
    groups.push(g)
  }

  // ── Tier 3 + Tier 4: Regional groups ──────────────────────────────────────
  if (topology !== 'global') {
    // Tier 3: strategy groups
    for (const r of _REGIONS) {
      const filter = useFilterAnchors ? `*Filter${r.key}` : _regionFilter(r.pattern ?? '', regionExcludes)
      const leafNames = [`${r.name}高速`, `${r.name}可用`]
      if (topology === 'advanced') leafNames.push(`${r.name}均衡-散列`, `${r.name}均衡-轮询`)

      const strat: any = {
        name: `${r.name}策略`,
        _anchorRef: 'GroupSelect',
        proxies: leafNames,
        'include-all': true,
        filter,
        'exclude-filter': '*FilterNotify',
      }
      if (r.icon) strat.icon = r.icon
      groups.push(strat)
    }

    // Tier 4: leaf groups
    const anchorForAutoType = autoType === 'smart' ? 'GroupSmart' : 'GroupUrlTest'
    // Smart leaf groups need explicit include-all/exclude-filter (GroupSmart doesn't extend GroupBase)
    const smartExtra = autoType === 'smart'
      ? { 'include-all': true }
      : {}

    for (const r of _REGIONS) {
      const filter = useFilterAnchors ? `*Filter${r.key}` : _regionFilter(r.pattern ?? '', regionExcludes)

      groups.push({ name: `${r.name}高速`, _anchorRef: anchorForAutoType, filter, hidden: true, ...smartExtra })
      groups.push({ name: `${r.name}可用`,  _anchorRef: 'GroupFallback',  filter, hidden: true })
      if (topology === 'advanced') {
        groups.push({ name: `${r.name}均衡-散列`, _anchorRef: 'GroupLBHash',  filter, hidden: true })
        groups.push({ name: `${r.name}均衡-轮询`, _anchorRef: 'GroupLBRobin', filter, hidden: true })
      }
    }
  }

  // ── Block groups (after regional groups for readability) ──────────────────
  groups.push(..._deferredBlock)

  // ── 🐟 漏网之鱼 (catch-all) ────────────────────────────────────────────────
  groups.push({ name: '🐟 漏网之鱼', type: 'select', proxies: ['Proxy', 'DIRECT'], icon: `${ICON_BASE}/Final.png` })

  return { groups, effectiveMap }
}

function _needsIpProvider2(gid, catalog) {
  if (gid === 'direct/cn-ips') return true
  if (_DIRECT_GROUPS.has(gid)) return false
  const info = (catalog?.items || {})[_slug2(gid)]
  if (!info) return true
  const splits = info.targets?.mihomo?.splits || []
  return splits.includes('ip') || splits.includes('ip-resolve')
}

function _buildRuleProvidersForFormat(groupIds, catalog, format = 'yaml-split') {
  const providers = {}
  const RULESET_CDN = `${CDN_BASE}@ruleset/mihomo`

  for (const gid of groupIds) {
    const s = _slug2(gid)

    if (format === 'yaml-classical') {
      providers[s] = {
        type: 'http', behavior: 'classical',
        url: `${RULESET_CDN}/${s}.yaml`,
        path: `./ruleset/${s}.yaml`,
        interval: RULE_INTERVAL, format: 'yaml',
      }
    } else if (format === 'binary') {
      if (gid !== 'direct/cn-ips') {
        providers[s] = {
          type: 'http', behavior: 'domain',
          url: `${RELEASES_BASE}/${s}.domain.mrs`,
          path: `./ruleset/${s}.domain.mrs`,
          interval: RULE_INTERVAL, format: 'mrs',
        }
      }
      if (_needsIpProvider2(gid, catalog)) {
        providers[`${s}-ip`] = {
          type: 'http', behavior: 'ipcidr',
          url: `${RELEASES_BASE}/${s}.ip.mrs`,
          path: `./ruleset/${s}.ip.mrs`,
          interval: RULE_INTERVAL, format: 'mrs',
        }
      }
    } else {
      // yaml-split (default)
      if (gid !== 'direct/cn-ips') {
        providers[s] = {
          type: 'http', behavior: 'domain',
          url: `${RULESET_CDN}/${s}.domain.yaml`,
          path: `./ruleset/${s}.domain.yaml`,
          interval: RULE_INTERVAL, format: 'yaml',
        }
      }
      if (_needsIpProvider2(gid, catalog)) {
        providers[`${s}-ip`] = {
          type: 'http', behavior: 'ipcidr',
          url: `${RULESET_CDN}/${s}.ip.yaml`,
          path: `./ruleset/${s}.ip.yaml`,
          interval: RULE_INTERVAL, format: 'yaml',
        }
      }
    }
  }
  return providers
}

function _buildRules2(groupIds, catalog, effectiveMap, features, format = 'yaml-split') {
  const rules = []
  const isSplit = format !== 'yaml-classical'

  if (features?.quic_block)
    rules.push('AND,((DST-PORT,443),(NETWORK,UDP),(NOT,((GEOIP,CN)))),🛡️ 协议拦截')

  // block groups → named proxy group (never hardcode REJECT)
  for (const gid of groupIds)
    if (_REJECT_GROUPS.has(gid)) {
      const name = _sgById.get(gid)?.name ?? `🚫 ${gid.split('/')[1]}`
      rules.push(`RULE-SET,${_slug2(gid)},${name}`)
    }

  // direct domain groups (cn-ips handled separately — IP only)
  for (const gid of groupIds)
    if (_DIRECT_GROUPS.has(gid) && gid !== 'direct/cn-ips')
      rules.push(`RULE-SET,${_slug2(gid)},DIRECT`)

  // service groups
  for (const gid of groupIds) {
    if (_DIRECT_GROUPS.has(gid) || _REJECT_GROUPS.has(gid)) continue
    rules.push(`RULE-SET,${_slug2(gid)},${(effectiveMap[gid] || [_slug2(gid)])[0]}`)
  }

  // IP rules (split formats only — separate -ip provider; classical has IP in main file)
  if (isSplit) {
    for (const gid of groupIds)
      if (gid === 'direct/cn-ips')
        rules.push(`RULE-SET,${_slug2(gid)}-ip,DIRECT,no-resolve`)
    for (const gid of groupIds) {
      if (_DIRECT_GROUPS.has(gid) || _REJECT_GROUPS.has(gid)) continue
      if (_needsIpProvider2(gid, catalog))
        rules.push(`RULE-SET,${_slug2(gid)}-ip,${(effectiveMap[gid] || [_slug2(gid)])[0]},no-resolve`)
    }
  } else {
    // classical: cn-ips IP rules are in the single file; no-resolve still applies
    for (const gid of groupIds)
      if (gid === 'direct/cn-ips')
        rules.push(`RULE-SET,${_slug2(gid)},DIRECT,no-resolve`)
  }

  rules.push('MATCH,🐟 漏网之鱼')
  return rules
}

function _renderProxyProviders(subUrls) {
  const anchorText = _tmpl(proxyProviderAnchorsTmpl, {
    infoPattern: _F.InfoPattern,
    healthUrl: globalSettingsData.health_url,
  })
  if (!subUrls.length) {
    return (
      anchorText.trimEnd() + '\n\n' +
      '# ── proxy providers ──────────────────────────────────────────────────────────\n' +
      "# proxy-providers:\n#   airport-1:\n#     <<: *ProxyProvider\n#     url: 'https://your-airport.com/subscribe?token=xxx'\n" +
      'proxy-providers: {}'
    )
  }
  const lines = [
    anchorText.trimEnd(),
    '',
    '# ── proxy providers ──────────────────────────────────────────────────────────',
    'proxy-providers:',
  ]
  subUrls.forEach((url, i) => {
    lines.push(`  airport-${i + 1}:`)
    lines.push(`    <<: *ProxyProvider`)
    lines.push(`    url: '${url}'`)
  })
  return lines.join('\n')
}


const _DIV = '# ' + '='.repeat(78)
/** Major section header — two-line banner matching YYDS style. */
function _section(title, subtitle) {
  return `${_DIV}\n# ${title}\n#   ${subtitle}\n${_DIV}`
}

/** Maps a proxy group to its YAML anchor name. */
function _groupAnchorName(g) {
  if (g._anchorRef) return g._anchorRef  // explicit anchor (P11/P12 groups)
  if (g.type === 'url-test')    return 'GroupUrlTest'
  if (g.type === 'fallback')    return 'GroupFallback'
  if (g.type === 'smart')       return 'GroupSmart'
  if (g.type === 'load-balance')
    return g.strategy === 'consistent-hashing' ? 'GroupLBHash' : 'GroupLBRobin'
  return 'GroupSelect'
}

// Fields each anchor covers — omit from per-group output.
// GroupBase (carried by GroupUrlTest/Fallback/LBHash/LBRobin via <<:) provides:
//   url, lazy, include-all, exclude-filter
// GroupSmart does NOT extend GroupBase — smart leaf groups must emit include-all/exclude-filter explicitly.
const _GROUP_ANCHOR_COVERS: Record<string, Set<string>> = {
  GroupSelect:        new Set(['type']),
  GroupUrlTest:       new Set(['type', 'url', 'interval', 'tolerance', 'lazy', 'include-all', 'exclude-filter']),
  GroupFallback:      new Set(['type', 'url', 'interval', 'tolerance', 'lazy', 'include-all', 'exclude-filter']),
  GroupLBHash:        new Set(['type', 'strategy', 'url', 'interval', 'tolerance', 'lazy', 'include-all', 'exclude-filter']),
  GroupLBRobin:       new Set(['type', 'strategy', 'url', 'interval', 'tolerance', 'lazy', 'include-all', 'exclude-filter']),
  GroupSmart:         new Set(['type', 'uselightgbm', 'url', 'interval', 'lazy']),
  GroupSelectProxy:   new Set(['type']),
  GroupSelectDirect:  new Set(['type']),
}
// GroupSelectXX — covers type, include-all, filter, exclude-filter
// proxies is intentionally NOT covered; emit only if non-null in group object
for (const r of _REGIONS) {
  _GROUP_ANCHOR_COVERS[`GroupSelect${r.key}`] = new Set(['type', 'include-all', 'filter', 'exclude-filter'])
}

function _yamlScalar(v) {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  const s = String(v)
  if (s.startsWith('*')) return s  // YAML anchor reference — never quote
  // single-quote strings that contain YAML-special characters
  if (/[:#\[\]{}&*!,|>'"%@`]/.test(s) || /^\s|\s$/.test(s)) {
    return `'${s.replace(/'/g, "''")}'`
  }
  return s
}

/** Renders the proxy-groups section with YAML anchors for each group type. */
function _renderProxyGroups(groups, topology, target) {
  const ctx = _proxyGroupAnchorCtx(topology, target)
  const anchorBlock = _tmpl(proxyGroupRegionAnchorsTmpl, ctx)

  const lines = [anchorBlock.trimEnd(), '', _proxyGroupStrategyAnchors().trimEnd(), '', 'proxy-groups:']

  // Insert blank lines between logical sections for readability
  const _isBlock = (g) => g.proxies?.[0] === 'REJECT'
  const _isFinal = (g) => g.name?.includes('漏网之鱼')
  const _isHidden = (g) => g.hidden
  const _isRegionStrategy = (g) => g.proxies?.some?.(p => typeof p === 'string' && (p.includes('高速') || p.includes('可用')))
  // Sort: move 人工智能 to front of service groups for display
  const _aiIdx = groups.findIndex(g => g.name === '人工智能')
  if (_aiIdx > 0) {
    const [ai] = groups.splice(_aiIdx, 1)
    const _firstService = groups.findIndex(g => !_isBlock(g) && !_isFinal(g) && !_isHidden(g) && !_isRegionStrategy(g))
    groups.splice(_firstService >= 0 ? _firstService : 0, 0, ai)
  }
  let _prevSection = ''

  for (const g of groups) {
    const section = _isBlock(g) || _isFinal(g) ? 'block' : _isHidden(g) ? 'hidden' : _isRegionStrategy(g) ? 'region' : 'service'
    if (section !== _prevSection && _prevSection !== '') lines.push('')
    _prevSection = section

    const anchor = _groupAnchorName(g)
    const skip   = _GROUP_ANCHOR_COVERS[anchor] || new Set()
    lines.push(`  - name: ${_yamlScalar(g.name)}`)
    lines.push(`    <<: *${anchor}`)
    for (const [k, v] of Object.entries(g)) {
      if (k === 'name' || k === '_anchorRef' || (skip.has(k) && k !== 'filter')) continue
      if (Array.isArray(v)) {
        lines.push(`    ${k}:`)
        for (const item of v) lines.push(`      - ${_yamlScalar(item)}`)
      } else {
        lines.push(`    ${k}: ${_yamlScalar(v)}`)
      }
    }
  }
  return lines.join('\n')
}


function _anchorFor(prov) {
  if (prov.format === 'mrs')
    return prov.behavior === 'domain' ? 'RuleProviderDomain_mrs' : 'RuleProviderIPCIDR_mrs'
  if (prov.behavior === 'domain')   return 'RuleProviderDomain'
  if (prov.behavior === 'ipcidr')   return 'RuleProviderIPCIDR'
  return 'RuleProviderClassical'
}

/** Renders the rule-providers section, emitting YAML anchors. */
function _renderRuleProviders(ruleProviders) {
  const anchorText = _ruleProviderAnchors().trimEnd()
  const lines = [
    anchorText.trimEnd(),
    '',
    '# ── rule providers ─────────────────────────────────────────────────────────────',
    'rule-providers:',
  ]
  for (const [key, prov] of Object.entries(ruleProviders)) {
    const anchor = _anchorFor(prov)
    lines.push(`  ${key}:`)
    lines.push(`    <<: *${anchor}`)
    lines.push(`    url: '${prov.url}'`)
    lines.push(`    path: ${prov.path}`)
  }
  return lines.join('\n') + '\n'
}


function _buildSections(target, features, geodata, rules, dnsOpts = {}) {
  const smart = target === 'mihomo-smart'
  const u = GEODATA_SOURCES[geodata] || GEODATA_SOURCES.metacubex
  return {
    core:    _tmpl(coreTmpl,     { dashboard: !!features.dashboard, smart }),
    geodata: _tmpl(geodataTmpl,  u),
    profile: _tmpl(profileTmpl,  { smart }),
    dns:     _tmpl(dnsTmpl, { ...DNS_DEFAULTS, ...dnsOpts }),
    sniffer: snifferTmpl.trimEnd(),
    tun:     features.tun_enable ? _tun().trimEnd() : '',
    rules:   'rules:\n' + rules.map(r => `  - ${r}`).join('\n'),
  }
}

/**
 * Build a complete standalone mihomo YAML profile.
 *
 * @param {string[]} subUrls       — subscription URLs
 * @param {string[]} groupIds      — selected catalog group IDs
 * @param {Object}   catalog       — from loadCatalog()
 * @param {Object}   opts
 * @param {string}   opts.topology — 'advanced' | 'regional' | 'global'
 * @param {string}   opts.target   — 'mihomo' | 'mihomo-smart'
 * @param {Object}   opts.features — { ads_block, quic_block, load_balance, ... }
 * @param {string}   opts.regionExcludes — regex negated in region filters
 * @returns {string} complete YAML profile
 */
export function buildFullProfile(subUrls: string[], groupIds: string[], catalog: CatalogManifest, opts: ProfileOptions = {}): string {
  const {
    topology = 'regional',
    target = 'mihomo',
    features = {},
    regionExcludes = '',
    geodata = 'metacubex',
    format = 'yaml-split',
    dns: dnsOpts = {},
  } = opts

  const { groups, effectiveMap } = _buildProxyGroups(groupIds, { topology, target, features, regionExcludes })
  const ruleProviders = _buildRuleProvidersForFormat(groupIds, catalog, format)
  const rules         = _buildRules2(groupIds, catalog, effectiveMap, features, format)

  const header = target === 'mihomo-smart'
    ? '# ⚠️  Requires vernesong/mihomo fork — https://github.com/vernesong/mihomo'
    : '# generated by hajimihomo · https://github.com/cest-la-v/hajimihomo'

  const s = _buildSections(target, features, geodata, rules, dnsOpts)

  const sections = [
    `${header}\n# topology: ${topology}  target: ${target}  groups: ${groupIds.length}`,

    _section('§1  CORE SETTINGS', 'kernel · geodata · profile · DNS · sniffer · TUN'),
    s.core, s.geodata, s.profile, s.dns, s.sniffer, s.tun,

    _section('§2  PROXIES', 'proxy providers · proxy groups'),
    _renderProxyProviders(subUrls),
    _renderProxyGroups(groups, topology, target),

    _section('§3  RULES', 'rule providers · rules'),
    _renderRuleProviders(ruleProviders),
    s.rules,
  ]

  return sections.join('\n\n')
}

/**
 * Build a complete mihomo profile from custom proxy groups (advanced mode).
 *
 * @param {string[]} subUrls — subscription URLs
 * @param {Object[]} customGroups — [{name, action, members: [{type:'group'|'category', id}]}]
 * @param {Object}   catalog — from loadCatalog()
 * @param {Object}   opts — same as buildFullProfile opts
 * @returns {string} complete YAML profile
 */
export function buildProfileFromCustomGroups(subUrls: string[], customGroups: CustomGroup[], catalog: CatalogManifest, opts: ProfileOptions = {}): string {
  const {
    topology = 'regional',
    target   = 'mihomo',
    features = {},
    regionExcludes = '',
    geodata  = 'metacubex',
    format   = 'yaml-split',
    dns: dnsOpts = {},
  } = opts

  // Collect all unique group IDs referenced by the custom config
  const allGroupIds = [...new Set(
    customGroups.flatMap(cg => cg.members
      .filter(m => m.type === 'group')
      .map(m => m.id)
    )
  )]

  // Build providers for all referenced groups (same as simple mode)
  const ruleProviders = _buildRuleProvidersForFormat(allGroupIds, catalog, format)

  // Build proxy groups: each custom group becomes a select proxy group
  const { groups: regionGroups } = _buildProxyGroups(allGroupIds, { topology, target, features, regionExcludes })

  // Override service groups with custom group names and actions
  const serviceGroups = customGroups.map(cg => {
    const action = cg.action || 'PROXY'
    return { name: cg.name, type: 'select', proxies: [action === 'PROXY' ? 'Proxy' : action, 'DIRECT'] }
  })

  // Effective map for rule routing: group ID → custom group name
  const effectiveMap = {}
  for (const cg of customGroups) {
    for (const m of cg.members) {
      if (m.type === 'group') effectiveMap[m.id] = [cg.name]
    }
  }

  // Build rules using custom effectiveMap
  const rules = _buildRules2(allGroupIds, catalog, effectiveMap, features, format)

  const header = `# generated by hajimihomo (advanced mode) · https://github.com/cest-la-v/hajimihomo`
  const s = _buildSections(target, features, geodata, rules, dnsOpts)

  // Merge region groups + custom service groups (deduplicated region groups first)
  const allGroups = [
    ...regionGroups.filter(g => !serviceGroups.find(sg => sg.name === g.name)),
    ...serviceGroups,
  ]

  const sections = [
    `${header}\n# topology: ${topology}  target: ${target}  custom-groups: ${customGroups.length}`,

    _section('§1  CORE SETTINGS', 'kernel · geodata · profile · DNS · sniffer · TUN'),
    s.core, s.geodata, s.profile, s.dns, s.sniffer, s.tun,

    _section('§2  PROXIES', 'proxy providers · proxy groups'),
    _renderProxyProviders(subUrls),
    _renderProxyGroups(allGroups, topology, target),

    _section('§3  RULES', 'rule providers · rules'),
    _renderRuleProviders(ruleProviders),
    s.rules,
  ]

  return sections.join('\n\n')
}
