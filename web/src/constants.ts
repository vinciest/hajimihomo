// ── Repository / CDN ──────────────────────────────────────────────────────────

export const REPO = 'cest-la-v/hajimihomo'
export const CDN_BASE = `https://cdn.jsdelivr.net/gh/${REPO}`
export const RELEASES_BASE = `https://github.com/${REPO}/releases/latest/download`

// In local dev with RULESET_DIR set, dev.ts proxies /ruleset/mihomo/* from local build.
// Detection: if the page is served from localhost, use a relative URL so the proxy intercepts.
const _isLocal = typeof location !== 'undefined' && location.hostname === 'localhost'
export const RULESETS_URL = _isLocal
  ? '/ruleset/mihomo/rulesets.json'
  : `${CDN_BASE}@ruleset/mihomo/rulesets.json`

// ── Ruleset split types ────────────────────────────────────────────────────────

// Ordering within a group's splits — ip-resolve is handled separately (always last globally)
export const SPLIT_ORDER = ['domain', 'residual', 'process', 'ip']
export const SPLIT_BEHAVIOR = {
  domain:       'domain',
  ip:           'ipcidr',
  'ip-resolve': 'ipcidr',
  residual:     'classical',
  process:      'classical',
}

// ── Geodata sources ────────────────────────────────────────────────────────────

export const GEODATA_SOURCES = {
  metacubex: {
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    geoip:   'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
    mmdb:    'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb',
    asn:     'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb',
  },
  dustinwin: {
    geosite: 'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-geodata/geosite.dat',
    geoip:   'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-geodata/geoip.metadb',
    mmdb:    'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-geodata/Country.mmdb',
    asn:     'https://github.com/DustinWin/ruleset_geodata/releases/download/mihomo-geodata/Country-ASN.mmdb',
  },
}

// ── Health check / intervals / icon bases ─────────────────────────────────────

export const HEALTH_URL = 'https://cp.cloudflare.com/generate_204'
export const RULE_INTERVAL = 86400
export const ORZ3_BASE = 'https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color'

// ── Proxy group configuration ──────────────────────────────────────────────────

// ── Icons ──────────────────────────────────────────────────────────────────────

export const ICON_BASE = 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color'

export const _CORE_KEYS = [
  'mixed-port', 'allow-lan', 'bind-address', 'mode', 'log-level',
  'ipv6', 'unified-delay', 'tcp-concurrent', 'find-process-mode',
  'global-client-fingerprint', 'global-ua', 'keep-alive-idle', 'keep-alive-interval',
  'etag-support',
  // conditionally present (dashboard feature):
  'external-controller', 'external-ui', 'external-ui-url', 'secret',
  // conditionally present (mihomo-smart target):
  'lgbm-auto-update', 'lgbm-update-interval', 'lgbm-url',
]
export const _GEODATA_KEYS = ['geodata-mode', 'geo-auto-update', 'geo-update-interval', 'geox-url']
