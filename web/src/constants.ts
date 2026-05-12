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

// Maps catalog group ID → [display name, preferred: string[]|null, anchorKey: string|null]
// preferred = null  → use anchor default proxies (don't emit explicit proxies list)
// preferred = []    → empty override (emit Proxy+DIRECT only, e.g. block/direct groups)
// anchorKey         → region key ('HK','US',...) or 'Proxy' or 'Direct' or null
export const SERVICE_MAP = {
  'block/ads':          ['🚫 广告拦截',   [],   null],
  'block/ads-lite':     ['🚫 广告(轻)',   [],   null],
  'block/tracking':     ['🕵 追踪拦截',   [],   null],
  'direct/cn':          ['🇨🇳 直连',      [],   null],
  'direct/cn-ips':      ['🇨🇳 直连IP',    [],   null],
  'direct/cn-no-media': ['🇨🇳 直连(无媒体)', [], null],
  'proxy/ai':           ['人工智能',  null,  'US'],
  'proxy/google':       ['谷歌服务',  null,  'HK'],
  'proxy/apple':        ['苹果服务',  null,  'HK'],
  'proxy/microsoft':    ['微软服务',  ['Proxy', '香港策略', '台湾策略', 'DIRECT'],  'Proxy'],
  'proxy/amazon':       ['亚马逊',    null,  'US'],
  'proxy/telegram':     ['电报消息',  null,  'HK'],
  'proxy/twitter':      ['推特/X',    null,  'US'],
  'proxy/youtube':      ['油管视频',  ['香港均衡-散列', '台湾均衡-散列', '美国均衡-散列', '香港策略', '台湾策略', '美国策略', 'Proxy', 'DIRECT'],  'HK'],
  'proxy/netflix':      ['奈飞视频',  ['美国均衡-散列', '狮城均衡-散列', '香港均衡-散列', '美国策略', '狮城策略', 'Proxy', 'DIRECT'],  'US'],
  'proxy/streaming':    ['流媒体',    ['美国均衡-散列', '狮城均衡-散列', '香港均衡-散列', '美国策略', '狮城策略', '香港策略', 'Proxy', 'DIRECT'],  'US'],
  'proxy/social':       ['社交平台',  null,  'HK'],
  'proxy/gaming':       ['游戏平台',  ['香港策略', '台湾策略', '日本策略', 'Proxy', 'DIRECT'],  'HK'],
  'proxy/dev':          ['开发工具',  ['Proxy', '香港策略', '狮城策略', 'DIRECT'],  'Proxy'],
  'proxy/finance':      ['金融服务',  null,  'HK'],
  'proxy/news':         ['新闻媒体',  ['美国策略', 'Proxy', 'DIRECT'],  'US'],
  'meta/block':         ['🚫 Meta拦截',  [],  null],
  'meta/cn':            ['🇨🇳 Meta直连', [],  null],
  'meta/foreign':       ['🌐 Meta外网',  ['Proxy'],  null],
}

export const _REGIONS = [
  { name: '香港', key: 'HK', pattern: '港|香港|🇭🇰|HK|HKG|Hong ?Kong' },
  { name: '台湾', key: 'TW', pattern: '台|台湾|🇹🇼|TW|TWN|Taiwan|TPE|TSA|KHH' },
  { name: '狮城', key: 'SG', pattern: '坡|狮城|新加坡|🇸🇬|SG|SGP|Singapore|SIN|XSP' },
  { name: '日本', key: 'JP', pattern: '日|日本|🇯🇵|JP|JPN|Japan|NRT|HND|KIX|CTS|FUK|东京|大阪|泉日|埼玉|沪日|深日|川日' },
  { name: '韩国', key: 'KR', pattern: '韩|韩国|🇰🇷|KR|KOR|Korea|南朝鲜|首尔' },
  { name: '美国', key: 'US', pattern: '美|美国|🇺🇸|US|USA|United ?States|SJC|JFK|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥' },
  { name: '欧盟', key: 'EU', pattern: '奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱|意|拉|立|卢|马|荷|波|葡|罗|西|瑞典|英|🇩🇪|🇫🇷|🇬🇧|🇳🇱|🇸🇪|CDG|FRA|AMS|LHR|MUC' },
]
export const _FALLBACK_REGIONS = ['香港', '狮城', '日本', '美国']
export const _JUNK_EXCLUDE = '群|邀请|返利|循环|官网|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|客服|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|(?i)USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author|Traffic'
export const _HIGH_MUL_EXCLUDE = 'X5|5x|X10|10x|DirectAccess|移动网络|禁止下载|禁止视频'
export const _DIRECT_GROUPS = new Set(['direct/cn', 'direct/cn-ips', 'direct/cn-no-media', 'meta/cn'])
export const _REJECT_GROUPS = new Set(['block/ads', 'block/ads-lite', 'block/tracking', 'meta/block'])

// ── Icons ──────────────────────────────────────────────────────────────────────

export const ICON_BASE = 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color'
export const REGION_ICONS = {
  '香港': 'Hong_Kong.png',
  '台湾': 'Taiwan.png',
  '狮城': 'Singapore.png',
  '日本': 'Japan.png',
  '韩国': 'Korea.png',
  '美国': 'United_States.png',
  '欧盟': 'European_Union.png',
}
export const SERVICE_ICONS = {
  'proxy/ai':        'AI.png',
  'proxy/google':    'Google_Search.png',
  'proxy/apple':     'Apple.png',
  'proxy/microsoft': 'Microsoft.png',
  'proxy/amazon':    'Amazon.png',
  'proxy/telegram':  'Telegram_X.png',
  'proxy/twitter':   'X.png',
  'proxy/youtube':   'YouTube.png',
  'proxy/netflix':   'Netflix.png',
  'proxy/streaming': 'Streaming.png',
  'proxy/social':    'PBS.png',
  'proxy/gaming':    'Game.png',
  'proxy/dev':       'https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color/github.png',
  'proxy/finance':   'Finance.png',
  'proxy/news':      'Apple_News.png',
}
export const BLOCK_ICONS = {
  'block/ads':      'Advertising.png',
  'block/ads-lite': 'Advertising.png',
  'block/tracking': 'Hijacking.png',
  'meta/block':     'Reject.png',
}

// ── Profile defaults key groups ────────────────────────────────────────────────

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
