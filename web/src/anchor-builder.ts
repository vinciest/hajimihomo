/**
 * anchor-builder.ts
 * Pure TypeScript — no Bun/Node APIs, independently testable.
 *
 * Compiles YAML meta-schema docs from profiles/ into usable data:
 *   compileFilters(doc)              → filter/regex data from filter-anchors.yaml
 *   compileGroupAnchors(doc)         → YAML text fragment from group-anchors.yaml
 *   compileRuleProviderAnchors(doc)  → YAML text fragment from rule-provider-anchors.yaml
 *
 * All three anchor files share the same meta-schema shape:
 *   - vars: (filter-anchors only) — template substitution variables
 *   - anchors: — list of anchor definitions, each with:
 *       name:    anchor name (meta — not emitted as a field)
 *       value:   string anchor content  (filter-anchors)
 *       object:  mapping anchor content (group-anchors, rule-provider-anchors)
 *       extends: parent anchor for <<: merge key (group-anchors only)
 *       label:   display name (filter-anchors region anchors only)
 */

// ── Anchor meta-schema types ──────────────────────────────────────────────────

/** A string-valued anchor (filter-anchors.yaml) */
export interface StringAnchorDef {
  name: string
  value: string
  label?: string  // present on region anchors; marks them as region entries
}

/** A mapping-valued anchor (group-anchors.yaml, rule-provider-anchors.yaml) */
export interface MappingAnchorDef {
  name: string
  object: Record<string, unknown>
  extends?: string
}

export interface FilterAnchorsDoc {
  vars: Record<string, string>
  anchors: StringAnchorDef[]
}

export interface GroupAnchorsDoc {
  anchors: MappingAnchorDef[]
}

export interface RuleProviderAnchorsDoc {
  anchors: MappingAnchorDef[]
}

// ── Template engine ───────────────────────────────────────────────────────────

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
 *
 * Reads flat vars: + anchors: structure:
 *   - anchors without label: → named string anchors (FilterInfo, FilterExclude)
 *   - anchors with label:    → region anchors (FilterHK, FilterTW, …)
 *     key derived from name: Filter<KEY>, pattern from vars: <lowercase-key>-pattern
 */
export function compileFilters(doc: any): FiltersData {
  const vars: Record<string, string> = doc?.vars ?? {}
  const anchors: any[] = doc?.anchors ?? []

  const namedAnchors: Record<string, string> = {}
  const regions: RegionEntry[] = []

  for (const a of anchors) {
    const value = applyTemplate(a.value ?? '', vars)
    namedAnchors[a.name] = value
    if (a.label) {
      const key = (a.name as string).replace(/^Filter/, '')
      const pattern = vars[key.toLowerCase() + '-pattern'] ?? ''
      regions.push({ name: a.label, key, pattern, filter: value })
    }
  }

  return {
    InfoPattern: vars['info-pattern'] ?? '',
    FilterInfo: namedAnchors['FilterInfo'] ?? '',
    FilterExclude: namedAnchors['FilterExclude'] ?? '',
    HighMulPattern: vars['custom-exclude-pattern'] ?? '',
    regions,
    ...Object.fromEntries(regions.map(r => [`Filter${r.key}`, r.filter])),
  }
}

// ── group-anchors.yaml compiler ───────────────────────────────────────────────

// Dummy key prefixes for group anchors — positional within their role bucket.
const _G_BASE_KEY  = '_g_base'
const _G_TYPE_KEYS = ['_g_ut', '_g_fb', '_g_lb_ch', '_g_lb_rr']
const _G_SEL_KEY   = '_g_sel'

/**
 * Resolve a field value: expand {{Var}} to *Var (YAML anchor reference).
 * Non-string values (booleans, numbers) are stringified as-is.
 */
function _resolveVal(v: unknown): string {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, '*$1')
  return String(v)
}

/** Emit YAML field lines for an `object:` mapping (all keys, no skip list needed). */
function _emitFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields).map(([k, v]) => `  ${k}: ${_resolveVal(v)}`)
}

/**
 * Compile a parsed group-anchors.yaml doc (flat anchors:[]) into a YAML text fragment.
 * Emits &GroupBase, &GroupUrlTest, … anchors.
 *
 * Anchor roles are inferred from the item itself:
 *   - no extends + not select type → base
 *   - has extends                  → type anchor
 *   - no extends + type: select   → select anchor
 */
export function compileGroupAnchors(doc: any): string {
  const parts: string[] = [
    '# ── Group base + type anchors ─────────────────────────────────────────────────',
    '# GroupBase carries url/lazy/include-all/exclude-filter — inherited by all auto types.',
    '# GroupSmart (vernesong fork) does NOT extend GroupBase; smart leaf groups must emit',
    '# include-all and exclude-filter explicitly.',
  ]

  const anchors: any[] = doc?.anchors ?? []
  let typeIdx = 0

  anchors.forEach(a => {
    const isSelect = a.object?.type === 'select'
    const dkey = a.extends
      ? (_G_TYPE_KEYS[typeIdx++] ?? `_g_type_${typeIdx - 1}`)
      : isSelect ? _G_SEL_KEY : _G_BASE_KEY

    parts.push(`${dkey}: &${a.name}`)
    if (a.extends) parts.push(`  <<: *${a.extends}`)
    parts.push(..._emitFields(a.object ?? {}))
    parts.push('')
  })

  return parts.join('\n').trimEnd()
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
    parts.push(..._emitFields(a.object ?? {}))
    parts.push('')
  })
  return parts.join('\n').trimEnd()
}
