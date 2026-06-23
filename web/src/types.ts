// Catalog types
export interface CatalogGroup {
  name: string
  description: string
  defaultAction: 'PROXY' | 'DIRECT' | 'REJECT'
  tags: string[]
  region: string
  memberCount: number
  members: string[]
}

export interface CategoryInfo {
  type: 'domain' | 'ip' | 'mixed' | 'unknown'
  groups: string[]
}

export interface Preset {
  label: string
  description: string
  target: 'mihomo' | 'mihomo-smart' | 'singbox'
  topology: 'global' | 'regional' | 'advanced'
  features: Record<string, boolean>
  groups: string[]
}

// Profile options
export type KernelTarget = 'mihomo' | 'mihomo-smart' | 'singbox'
export type Topology = 'global' | 'regional' | 'advanced'
export type GeodataSource = 'metacubex' | 'dustinwin'
export type RuleFormat = 'yaml-classical' | 'yaml-split' | 'binary'
export type Deployment = 'router' | 'desktop'

export interface ProfileOptions {
  topology?: Topology
  target?: KernelTarget
  deployment?: Deployment
  features?: Record<string, boolean>
  regionExcludes?: string
  geodata?: GeodataSource
  format?: RuleFormat
  subUrls?: string[]
  dns?: {
    default_nameserver?: string[]
    nameserver?: string[]
    fallback?: string[]
    nameserver_policy?: Array<{ domain: string; servers: string[] }>
  }
}

export interface Sub {
  name: string
  url: string
}

export interface CustomGroupMember {
  type: 'group' | 'category'
  id: string
  label: string
}

export interface CustomGroup {
  name: string
  action: 'PROXY' | 'DIRECT' | 'REJECT'
  members: CustomGroupMember[]
}

// Catalog manifest from rulesets.json
export interface CatalogManifest {
  items: Record<string, CatalogItem>
  generated_at?: string
}

export interface CatalogItem {
  kind: 'group' | 'atomic'
  group_id?: string
  name?: string
  default_action?: string
  region?: string
  tags?: string[]
  behavior?: string
  targets?: {
    mihomo?: { splits: string[] }
    singbox?: { splits?: string[]; path?: string }
  }
}
