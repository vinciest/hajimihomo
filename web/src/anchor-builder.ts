/**
 * anchor-builder.ts
 * Pure TypeScript — no Bun/Node APIs, independently testable.
 *
 * Compiles YAML meta-schema docs from profiles/ into usable data:
 *   compileFilters(doc)      → filter/regex data from filter-anchors.yaml
 *   compileGroupAnchors(doc) → YAML text fragment from group-anchors.yaml
 *
 * Both use the same {{var}} substitution engine.
 */

/** Replace all {{varName}} tokens with values from vars map. */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '')
}

// ── filter-anchors.yaml compiler ─────────────────────────────────────────────

export interface RegionEntry {
  name: string
  key: string
  pattern: string
  filter: string
}

export interface FiltersData {
  InfoPattern: string
  FilterInfo: string
  FilterExclude: string
  HighMulPattern: string
  regions: RegionEntry[]
  [key: string]: unknown // FilterHK, FilterTW, …
}

/**
 * Compile a parsed filter-anchors.yaml doc into the filter data object
 * consumed by ProfileBuilder and the yaml-b64 plugin.
 */
export function compileFilters(doc: any): FiltersData {
  const infoPattern: string = doc?.patterns?.['info-pattern'] ?? ''
  const highMulPattern: string = doc?.patterns?.['custom-exclude-pattern'] ?? ''
  const filterTemplates: Record<string, string> = doc?.filters ?? {}

  const sharedVars = { 'info-pattern': infoPattern, 'custom-exclude-pattern': highMulPattern }
  const filterInfo = applyTemplate(filterTemplates['info-filter'] ?? '', sharedVars)
  const filterExclude = applyTemplate(filterTemplates['exclude-filter'] ?? '', sharedVars)

  const regions: RegionEntry[] = (doc?.regions ?? []).map((r: any) => {
    const excludePat: string = r['exclude-pattern'] ?? ''
    const regionVars = {
      'region-pattern': r.pattern ?? '',
      'region-exclude-pattern': excludePat,
    }
    const tmplKey = excludePat ? 'region-filter-mix' : 'region-filter'
    return {
      name: r.name,
      key: r.key,
      pattern: r.pattern,
      filter: applyTemplate(filterTemplates[tmplKey] ?? '', regionVars),
    }
  })

  const filterShortcuts = Object.fromEntries(regions.map(r => [`Filter${r.key}`, r.filter]))

  return { InfoPattern: infoPattern, FilterInfo: filterInfo, FilterExclude: filterExclude, HighMulPattern: highMulPattern, regions, ...filterShortcuts }
}

// ── group-anchors.yaml compiler ───────────────────────────────────────────────

// Well-known dummy key names for the group type anchors (positional).
const _TYPE_KEYS = ['_g_ut', '_g_fb', '_g_lb_ch', '_g_lb_rr']

/**
 * Resolve a field value: expand {{Var}} to *Var (YAML anchor reference).
 * Non-string values (booleans, numbers) are stringified as-is.
 */
function _resolveVal(v: unknown): string {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, '*$1')
  return String(v)
}

/** Emit YAML field lines for a `config:` object (all keys, no skip list needed). */
function _emitFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields).map(([k, v]) => `  ${k}: ${_resolveVal(v)}`)
}

/**
 * Compile a parsed group-anchors.yaml doc into a YAML text fragment
 * ready to be prepended into a generated mihomo profile.
 *
 * Emits &GroupBase, &GroupUrlTest, … anchors.
 */
export function compileGroupAnchors(doc: any): string {
  const parts: string[] = []

  parts.push(
    '# ── Group base + type anchors ─────────────────────────────────────────────────',
    '# GroupBase carries url/lazy/include-all/exclude-filter — inherited by all auto types.',
    '# GroupSmart (vernesong fork) does NOT extend GroupBase; smart leaf groups must emit',
    '# include-all and exclude-filter explicitly.',
  )

  // base anchor
  const base = doc?.base ?? {}
  parts.push(`_g_base: &${base.name}`)
  parts.push(..._emitFields(base.config ?? {}))
  parts.push('')

  // type anchors
  const types: any[] = doc?.types ?? []
  types.forEach((t, i) => {
    const dkey = _TYPE_KEYS[i] ?? `_g_type_${i}`
    parts.push(`${dkey}: &${t.name}`)
    parts.push(`  <<: *${t.extends}`)
    parts.push(..._emitFields(t.config ?? {}))
    parts.push('')
  })

  // bare select anchor
  const sel = doc?.select
  if (sel) {
    parts.push(`_g_sel: &${sel.name}`)
    parts.push(..._emitFields(sel.config ?? {}))
  }

  return parts.join('\n')
}

// ── rule-provider-anchors.yaml compiler ──────────────────────────────────────

/** Derive dummy mapping key from anchor name: RuleProviderDomain → _p_domain */
function _ruleProviderKey(name: string): string {
  return '_p_' + name.replace(/^RuleProvider/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_$/, '')
}

/**
 * Compile a parsed rule-provider-anchors.yaml doc into a YAML text fragment.
 * Emits &RuleProviderDomain, &RuleProviderIPCIDR, … anchors.
 */
export function compileRuleProviderAnchors(doc: any): string {
  const parts: string[] = [
    '# ── rule provider anchors ─────────────────────────────────────────────────────',
    '# Edit profiles/rule-provider-anchors.yaml to update all rule-providers of each type.',
  ]
  const anchors: any[] = doc?.anchors ?? []
  anchors.forEach(a => {
    parts.push(`${_ruleProviderKey(a.name)}: &${a.name}`)
    parts.push(..._emitFields(a.config ?? {}))
    parts.push('')
  })
  return parts.join('\n').trimEnd()
}
