#!/usr/bin/env bun
/**
 * hajimihomo CLI — generate a complete mihomo profile from preset + user config.
 *
 * Usage: hajimihomo [options]
 *   --preset   mini|lite|standard|full         (default: standard)
 *   --sub      https://airport.com/sub?tok=xxx  (repeatable; overrides user.yaml subs)
 *   --user     path/to/user.yaml               (default: profiles/user.yaml)
 *   --output   path/to/output/dir              (default: dist/profiles)
 *   --catalog  path/to/rulesets.json           (default: dist/rulesets.json)
 *   --format   yaml-split|yaml-classical|binary (default: yaml-split)
 *   --geodata  metacubex|dustinwin             (default: metacubex)
 *   --target   mihomo|mihomo-smart             (overrides preset)
 *   --topology global|regional|advanced        (overrides preset)
 *   --help                                     show this message
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'
import yaml from 'js-yaml'
import { buildFullProfile } from './src/ProfileBuilder'
import { buildHostsBlock } from './hosts.js'

const ROOT = resolve(import.meta.dir, '..')
const PRESET_DIR = join(ROOT, 'profiles/presets')
const DEFAULT_USER = join(ROOT, 'profiles/user.yaml')
const DEFAULT_OUTPUT = join(ROOT, 'dist/profiles')
const DEFAULT_CATALOG = join(ROOT, 'dist/rulesets.json')

// ── arg parsing ──────────────────────────────────────────────────────────────

interface ParsedArgs {
  flags: Record<string, string>
  subs: string[]   // --sub (repeatable)
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string> = {
    preset: 'standard',
    user: DEFAULT_USER,
    output: DEFAULT_OUTPUT,
    catalog: DEFAULT_CATALOG,
    format: 'yaml-split',
    geodata: 'metacubex',
  }
  const subs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') { printHelp(); process.exit(0) }
    if (a === '--sub' && argv[i + 1]) { subs.push(argv[++i]); continue }
    const key = a.replace(/^--/, '')
    if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      flags[key] = argv[++i]
    }
  }
  return { flags, subs }
}

function printHelp() {
  console.log(`\
hajimihomo — mihomo profile builder

Usage: hajimihomo [options]

Options:
  --preset    mini|lite|standard|full            (default: standard)
  --sub       subscription URL                   (repeatable; overrides user.yaml subs)
  --user      path/to/user.yaml                  (default: profiles/user.yaml)
  --output    output directory                   (default: dist/profiles)
  --catalog   path/to/rulesets.json              (default: dist/rulesets.json)
  --format    yaml-split|yaml-classical|binary   (default: yaml-split)
  --geodata   metacubex|dustinwin                (default: metacubex)
  --target    mihomo|mihomo-smart                (overrides preset)
  --topology  global|regional|advanced           (overrides preset)
  --deployment router|desktop                    (default: desktop)
  --help      show this message

When no --sub flags and no user.yaml exist, an interactive wizard runs to
collect subscription URLs and optionally saves them to user.yaml.`)
}

// ── preset loading ───────────────────────────────────────────────────────────

function loadPreset(name: string): Record<string, any> {
  // Try consolidated profiles/presets.yaml first
  const consolidated = resolve(import.meta.dir, '../profiles/presets.yaml')
  if (existsSync(consolidated)) {
    const data = (yaml.load(readFileSync(consolidated, 'utf8')) || {}) as any
    if (data.presets?.[name]) return data.presets[name]
  }
  // Fallback: individual preset files (legacy)
  const files = [
    join(PRESET_DIR, `${name}.yaml`),
    ...['1', '2', '3', '4'].map(n => join(PRESET_DIR, `${n}-${name}.yaml`)),
  ]
  for (const f of files) {
    if (existsSync(f)) return (yaml.load(readFileSync(f, 'utf8')) || {}) as Record<string, any>
  }
  throw new Error(`Preset '${name}' not found`)
}

// ── user config ───────────────────────────────────────────────────────────────

interface UserConfig {
  proxy_providers?: Array<{ name: string; url: string; prefix?: string }>
  target?: string
  topology?: string
  deployment?: string
  geodata?: string
  format?: string
  extra_groups?: string[]
  skip_groups?: string[]
  region_excludes?: string
  hosts_enabled?: boolean
  hosts_include?: string[]
  hosts_exclude?: string[]
  dns?: {
    nameserver?: string[]
    fallback?: string[]
    default_nameserver?: string[]
    nameserver_policy?: Array<{ domain: string; servers: string[] }>
  }
  overrides?: Record<string, any>
}

function loadUser(path: string): UserConfig | null {
  if (!existsSync(path)) return null
  return (yaml.load(readFileSync(path, 'utf8')) || {}) as UserConfig
}

// ── interactive wizard ────────────────────────────────────────────────────────

async function runWizard(userPath: string): Promise<string[]> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const subUrls: string[] = []

  const ask = (q: string) => rl.question(q).catch(() => '')

  console.log('\n✨ No subscription URLs found. Enter your proxy airport subscription(s).\n')

  while (true) {
    const url = (await ask('  Subscription URL (empty to finish): ')).trim()
    if (!url) break
    subUrls.push(url)
    console.log(`  ✓ Added (${subUrls.length})`)
  }

  if (subUrls.length > 0) {
    const ans = (await ask(`\n  Save to ${userPath}? [Y/n] `)).trim().toLowerCase()
    if (!ans || ans === 'y') {
      const providerLines = subUrls.map((url, i) =>
        `  - name: "Airport ${i + 1}"\n    url: "${url}"`
      ).join('\n')
      const content = `\
# hajimihomo user configuration
# Edit this file to customize your profile.

# ── proxy subscriptions ───────────────────────────────────────────────────────
proxy_providers:
${providerLines}

# ── preset customization ──────────────────────────────────────────────────────
# target: mihomo         # mihomo (default) | mihomo-smart (vernesong fork)
# topology: regional     # global | regional | advanced (inherits from preset)

# extra_groups: []       # add catalog groups on top of preset
# skip_groups: []        # remove catalog groups from preset

# region_excludes: ""    # regex appended to region filter negations
#                        # e.g. "5x|10x|GB" to exclude bulk-relay nodes

# ── DNS customization ────────────────────────────────────────────────────────
# dns:
#   nameserver:          # DoH/DoT servers for domestic domains
#     - https://doh.pub/dns-query
#     - https://dns.alidns.com/dns-query
#   fallback:            # servers for foreign domains (plain IPs work without proxy)
#     - 8.8.4.4
#     - 1.1.1.1
#     - 9.9.9.9
#   default_nameserver:  # bootstrap resolvers (plain IPs only)
#     - 223.5.5.5
#     - 119.29.29.29
#   nameserver_policy:   # per-domain DNS routing
#     - domain: "geosite:apple"
#       servers: [https://doh.pub/dns-query]
#     - domain: "+.google.com"
#       servers: [tls://8.8.8.8]

# ── hosts block ───────────────────────────────────────────────────────────────
hosts_enabled: false     # set true to resolve polluted domains via DoH
# hosts_include: []      # opt-in specific domains (empty = all polluted ones)
# hosts_exclude: []      # always skip these domains

# ── profile overrides ────────────────────────────────────────────────────────
# Merged onto the generated profile. Top-level keys are appended; rules can be
# inserted at the right priority position.
# overrides:
#   hosts:                                 # DNS pollution workarounds
#     "api.onedrive.com": 13.105.28.18
#     "skydrivesync.policies.live.net": 13.105.28.18
#   prepend_rules:                         # inserted BEFORE generated rules (high priority)
#     - DOMAIN-SUFFIX,push.douban.com,REJECT
#     - DOMAIN,cdn.jsdelivr.net,Proxy
#   extra_rules:                           # appended AFTER MATCH (low priority)
#     - PROCESS-NAME,WeChat,DIRECT
#     - PROCESS-NAME,小米互联服务,DIRECT
`
      mkdirSync(dirname(resolve(userPath)), { recursive: true })
      writeFileSync(userPath, content)
      console.log(`  ✓ Saved to ${userPath}\n`)
    }
  } else {
    console.log('  (no URLs entered — generating profile without proxy providers)\n')
  }

  rl.close()
  return subUrls
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, subs: flagSubs } = parseArgs(process.argv.slice(2))

  const preset = loadPreset(flags.preset)

  // Priority: --sub flags → user.yaml → interactive wizard
  let user: UserConfig = {}
  let subUrls: string[]

  if (flagSubs.length > 0) {
    // flags win; still load file for non-sub settings if it exists
    user = loadUser(flags.user) || {}
    subUrls = flagSubs
  } else {
    const loaded = loadUser(flags.user)
    if (loaded !== null) {
      user = loaded
      subUrls = (user.proxy_providers || []).map((p: any) => p.url).filter(Boolean)
    } else {
      // first-run wizard
      subUrls = await runWizard(flags.user)
    }
  }

  const target     = flags.target     || user.target     || preset.target     || 'mihomo'
  const topology   = flags.topology   || user.topology    || preset.topology   || 'regional'
  const deployment = (flags.deployment || user.deployment || 'desktop') as 'router' | 'desktop'
  const geodata    = flags.geodata    || user.geodata     || 'metacubex'
  const format     = flags.format     || user.format      || 'yaml-split'

  let groupIds: string[] = preset.groups || []
  if (user.extra_groups?.length) groupIds = [...groupIds, ...user.extra_groups]
  if (user.skip_groups?.length) {
    const skip = new Set(user.skip_groups)
    groupIds = groupIds.filter((g: string) => !skip.has(g))
  }

  if (!existsSync(flags.catalog)) {
    console.error(`[error] catalog not found at ${flags.catalog}`)
    console.error(`  Run 'make build-groups' first to generate dist/rulesets.json`)
    process.exit(1)
  }
  const catalog = JSON.parse(readFileSync(flags.catalog, 'utf8'))

  const opts: Record<string, any> = {
    topology, target, deployment, format, geodata,
    features: preset.features || {},
    regionExcludes: user.region_excludes || '',
    dns: user.dns || {},
  }

  let profile = buildFullProfile(subUrls, groupIds, catalog, opts)

  // ── User overrides ──────────────────────────────────────────────────────────
  // Merge user overrides onto the generated profile. New top-level keys (hosts,
  // etc.) are appended. For rules, use extra_rules / prepend_rules to inject
  // custom entries at the right priority position.
  if (user.overrides) {
    const ov = user.overrides as Record<string, any>
    const parts: string[] = []

    // Prepend rules (highest priority — before generated rules)
    if (Array.isArray(ov.prepend_rules) && ov.prepend_rules.length) {
      // Insert after the "rules:" line
      const rulesIdx = profile.indexOf('\nrules:\n')
      if (rulesIdx !== -1) {
        const insertPos = rulesIdx + '\nrules:\n'.length
        const ruleLines = ov.prepend_rules.map((r: string) => `  - ${r}`).join('\n') + '\n'
        profile = profile.slice(0, insertPos) + ruleLines + profile.slice(insertPos)
      }
    }

    // Append rules (lowest priority — after MATCH)
    if (Array.isArray(ov.extra_rules) && ov.extra_rules.length) {
      const ruleLines = '\n' + ov.extra_rules.map((r: string) => `  - ${r}`).join('\n')
      profile = profile.replace(
        /(  - MATCH,🐟 漏网之鱼)$/,
        `$1${ruleLines}`
      )
    }

    // Merge top-level keys (hosts, etc.)
    for (const [key, val] of Object.entries(ov)) {
      if (key === 'prepend_rules' || key === 'extra_rules') continue
      if (val != null) {
        const dumped = yaml.dump(val, { lineWidth: -1, noRefs: true, indent: 2 }).trimEnd()
        // Indent nested content (yaml.dump doesn't indent top-level keys)
        const indented = dumped.split('\n').map((line: string) => `  ${line}`).join('\n')
        parts.push(`${key}:\n${indented}`)
      }
    }

    if (parts.length) profile += '\n\n' + parts.join('\n\n')
  }

  if (user.hosts_enabled) {
    try {
      const hostsBlock = await buildHostsBlock({
        include: user.hosts_include || [],
        exclude: user.hosts_exclude || [],
      })
      if (hostsBlock) profile += '\n\n' + hostsBlock
    } catch (e) {
      console.warn(`[warn] hosts block build failed: ${(e as Error).message}`)
    }
  }

  mkdirSync(flags.output, { recursive: true })
  const outFile = join(flags.output, `${flags.preset}.yaml`)
  writeFileSync(outFile, profile + '\n')
  console.log(`[ok] wrote ${outFile}  (${(profile.length / 1024).toFixed(1)} KB)`)
}

main().catch(e => { console.error(e.message); process.exit(1) })

