## Research Document: Mihomo Proxy-Group & Filter Patterns

### **1. Overview**

The four analyzed config files demonstrate **two primary architectural patterns**:

1. **YYDS Configs (MihomoPro.yaml, OneSmart.yaml, OneSmartPro.yaml)**: 
   - Filter-per-region pattern with provider-level exclusion
   - Hierarchical group structure: Master Select → Feature/Regional Sub-groups → Auto-test/Load-balance leaf groups
   - Regional "智能" (smart) groups using consistent strategies

2. **Merge.yaml**: 
   - Mixed architecture with anchors defining base groups and filters separately
   - Advanced filter composition with multiple regex arrays
   - More granular control with exclude-filter at both provider and group levels
   - Greater emphasis on performance-based filtering (Fast, Premium, Edge)

---

### **2. Proxy Providers Schema**

→ See `docs/proxy-provider-patterns.md` for provider template, filter mechanics, prefix tagging, and `use:` vs `include-all`.

---

### **3. Proxy Group Hierarchy & Types**

#### **3.1 Group Type Reference**

| Type | Purpose | Use Case | Key Params |
|------|---------|----------|-----------|
| **select** | Manual selection | UI group, application entry point | `proxies:`, `include-all:`, `filter:` |
| **url-test** | Auto speed test | Regional fast groups | `url:`, `interval:`, `tolerance:`, `max-failed-times:`, `lazy:` |
| **fallback** | Failover chain | Redundancy, line characterization | `url:`, `interval:`, `lazy:` |
| **load-balance** | Distribution | Relay, bandwidth sharing | `strategy:` (round-robin or consistent-hashing) |
| **smart** | ML-based selection | Latency/jitter optimization | `uselightgbm:`, `policy-priority:`, `interval:` |

#### **3.2 Merge.yaml Base Group Templates**

```yaml
BaseGroupSelect: &BaseGroupSelect
  type: "select"
  icon: "https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color/Static.png"

BaseGroupFast: &BaseGroupFast
  type: "url-test"
  url: "https://www.gstatic.com/generate_204"
  expected-status: 204
  interval: 180
  tolerance: 100
  timeout: 1000
  max-failed-times: 3
  lazy: true
  icon: "https://fastly.jsdelivr.net/gh/Orz-3/mini@master/Color/Urltest.png"

BaseGroupAvailable: &BaseGroupAvailable
  type: "fallback"
  url: "https://www.gstatic.com/generate_204"
  expected-status: 204
  interval: 600
  tolerance: 100
  lazy: true

BaseGroupBalanceRobin: &BaseGroupBalanceRobin
  type: "load-balance"
  strategy: "round-robin"
  url: "https://www.gstatic.com/generate_204"
  interval: 600
  tolerance: 100
  lazy: true

BaseGroupBalanceHashing: &BaseGroupBalanceHashing
  type: "load-balance"
  strategy: "consistent-hashing"
  url: "https://www.gstatic.com/generate_204"
  interval: 600
  tolerance: 100
  lazy: true
```

---

### **4. Proxy-Group Hierarchy Tiers**

#### **4.1 YYDS 4-Tier Architecture** (MihomoPro.yaml)

**Tier 1: Application Layer (Master Select)**
```yaml
- {name: 默认代理, <<: *SelectFB}        # Default proxy selector
- {name: 国外流量, <<: *SelectPY}        # Global traffic
- {name: 国内流量, <<: *SelectDC}        # China domestic
- {name: 兜底流量, <<: *SelectPY}        # Final fallback
```
- Type: `select` (manual UI selection)
- Purpose: Entry points for traffic rules
- Proxies: References to sub-groups (not raw nodes)

**Tier 2: Feature/Regional Selector**
```yaml
- {name: 香港策略, type: select, 
   proxies: [香港自动, 香港均衡-散列, 香港均衡-轮询],
   include-all: true,                  # Include all proxies from all providers
   filter: *FilterHK}                  # Apply region filter to included proxies
```

**Tier 3: Auto-Test Groups** (Speed test selector)
```yaml
- {name: 香港自动, <<: *BaseUT,
   include-all: true,
   filter: *FilterHK}
```
- Type: `url-test`
- Tests all HK nodes periodically; returns fastest

**Tier 4: Load-Balance Groups** (Distribution strategies)
```yaml
- {name: 香港均衡-散列, <<: *BaseCH,
   include-all: true,
   filter: *FilterHK}                  # Consistent-hashing strategy
   
- {name: 香港均衡-轮询, <<: *BaseCR,
   include-all: true,
   filter: *FilterHK}                  # Round-robin strategy
```

#### **4.2 Merge.yaml Mixed Tier Architecture**

```yaml
# Region-based groups that mix proxies and include-all:
- name: "香港节点"
  <<: *BaseGroupFastRegion           # url-test type, include-all: true
  filter: *BaseFilterRegionHK
  
# Feature groups with explicit proxy lists:
- name: "Proxy"
  <<: *BaseGroupSelect
  proxies:
    - Auto-Fast
    - Auto-Edge
    - "香港节点"
    - "台湾节点"
    - ...
  include-all: true                  # Plus all other proxies!
  exclude-filter: *ProxyFilterAnnouncement

# Performance-based group with filter array:
- name: Auto-Edge
  <<: *BaseGroupBalanceRobin
  include-all: true
  filter: *ProxyFilterEdge            # Uses array of regex patterns
  exclude-filter: *ProxyFilterGlobalExclude
```

---

### **5. Filter & Exclude-Filter Mechanics**

#### **5.1 Filter vs Exclude-Filter Distinction**

**`filter`**: Positive selection regex (what to **INCLUDE**)
```yaml
filter: '^(?=.*(?i)(港|🇭🇰|HK|Hong|HKG))(?!.*(排除1|排除2|5x)).*$'
         # Must contain: 港 OR 🇭🇰 OR HK OR Hong OR HKG
         # AND must NOT contain: 排除1 OR 排除2 OR 5x
```

**`exclude-filter`**: Negative selection regex (what to **EXCLUDE**)
```yaml
exclude-filter: "DirectAccess|禁止视频|禁止下载"
                # Remove nodes containing these keywords
```

#### **5.2 Filter Array Pattern** (Merge.yaml)

Advanced filters using multi-line regex arrays:

```yaml
ProxyFilterFast: &ProxyFilterFast >-
  ---
  `^((?=.*(高速|Fast|中转|Relay|CDN|ECDN|AGA|Balancer|专线|Dedicated|IPLC|IEPL|固定IP|Fixed|原生|Native|家宽|Residential))|(?!.*(X5|5x|X10|10x)))(?=.*(🇭🇰|HK|HKG|\b港\b|香港|(?i)HongKong|Hong Kong)).*$`-
  `^((?=.*(高速|Fast|中转|Relay|CDN|ECDN|AGA|Balancer|专线|Dedicated|IPLC|IEPL|固定IP|Fixed|原生|Native|家宽|Residential))|(?!.*(X5|5x|X10|10x)))(?=.*(🇹🇼|TW|TWN|\b台\b|台湾|(?i)Taiwan)).*$`-
  `^((?=.*(高速|Fast|中转|Relay|CDN|ECDN|AGA|Balancer|专线|Dedicated|IPLC|IEPL|固定IP|Fixed|原生|Native|家宽|Residential))|(?!.*(X5|5x|X10|10x)))(?=.*(🇸🇬|SG|SGP|\b坡\b|狮城|新加坡|(?i)Singapore)).*$`-
  ---
```

**What it does:**
- Multiple regex patterns (HK, TW, SG) in single array
- Each pattern matches "fast" nodes in that region
- Must contain: fast/relay/CDN/ECDN/professional keywords
- OR must NOT contain: X5/5x/X10/10x (expensive high-multiplier nodes)

#### **5.3 Filter Examples Reference Table**

| Filter Name | Pattern | Targets | Excludes | Use Case |
|---|---|---|---|---|
| **FilterHK** | `港\|🇭🇰\|HK\|Hong\|HKG` | Hong Kong nodes | `排除1\|排除2\|5x` | Regional selector |
| **FilterTW** | `台\|🇹🇼\|TW\|TPE\|TSA\|KHH` | Taiwan nodes | `排除1\|排除2\|5x` | Regional selector |
| **FilterAL** | `^(?!.*\(DIRECT\|群\|邀请\|...))` | All nodes except junk | Announcements, setup | Manual/fallback groups |
| **ProxyFilterAnnouncement** | `群\|邀请\|返利\|循环\|官网\|...` | Announcement nodes | N/A | Filter TO announcement-only groups |
| **ProxyFilterFast** | Array: region-specific fast profiles | Fast+relay+CDN nodes | `X5\|5x\|X10\|10x` | Premium speed groups |
| **ProxyFilterEdge** | Array: CDN+streaming optimized | High-BW CDN nodes | `专线\|Fixed\|Native\|Residential` | Streaming/download |
| **ProxyFilterPremium** | `专线\|Dedicated\|IPLC\|...` OR `美国` OR `台湾` | Dedicated lines + US+TW | N/A | Scholar/AI groups |

---

### **6. Group Naming Conventions**

#### **6.1 Emoji + Region Naming**

From all YYDS files:
```
🇭🇰 香港 → Hong Kong
🇹🇼 台湾 → Taiwan  
🇯🇵 日本 → Japan
🇰🇷 韩国 → Korea
🇸🇬 狮城 → Singapore
🇺🇸 美国 → United States
🇪🇺 欧洲 → EU
```

#### **6.2 Group Naming Patterns**

**YYDS Pattern (Consistent across all 3 files):**
- Master: `一键智能`, `默认代理`
- Features: `人工智能`, `社交平台`, `电报消息`, `游戏平台`, `Emby服`, `国际媒体`
- Regional: `香港智能`, `台湾智能`, `日本智能`, `狮城智能`, `韩国智能`, `美国智能`, `欧洲智能`
- Auto: `香港自动`, `台湾自动`, etc. (type: url-test)
- Load-balance: `香港均衡-散列`, `香港均衡-轮询`
- Fallback: `高质量线路`, `低延迟线路`, `大带宽线路`, `低倍率线路` (OneSmartPro)

**Merge.yaml Pattern:**
- Regional: `"香港节点"`, `"台湾节点"`, `"美国节点"` (with quotes, type: url-test)
- Features: `"AI"`, `"Netflix"`, `"TikTok"`, `"谷歌服务"`, `"苹果服务"`
- Special: `"Proxy"`, `"通知公告"`, `Auto-Fast`, `Auto-Edge`

---

### **7. Include-All & Use Patterns**

#### **7.1 Include-All: Providers**

```yaml
- name: 香港策略
  type: select
  proxies: [香港自动, 香港均衡-散列]  # Explicit sub-groups
  include-all: true                  # ALSO add all nodes from all proxy-providers
  filter: *FilterHK                  # But only those matching this regex
```

**Result:** Group contains:
1. Named proxies (香港自动, 香港均衡-散列)
2. All nodes from all providers matching `^(?=.*港)...` (HK filter)

#### **7.2 Use: Provider References**

From OneSmartPro.yaml line 203:
```yaml
- name: 中转服务
  <<: *BaseLB                        # load-balance type
  use: [优质服务商]                  # Use ONLY nodes from this provider
  filter: 'HK|TW'                    # Filter to HK or TW nodes
  hidden: true
```

**Difference from include-all:**
- `use: [provider_name]`: Use proxies from **named providers only**
- `include-all: true`: Use proxies from **ALL providers**

---

### **8. Key Design Patterns**

#### **8.1 Smart Policy Priority** (Regional Intelligence)

```yaml
- name: 香港智能
  type: smart
  filter: *FilterHK
  include-all: true
  policy-priority: '优:2;备:0.5'      # Weight nodes by keyword
  interval: 200
  lazy: true
  uselightgbm: true
```

**How it works:**
- Loads all HK nodes from all providers
- Extracts prefixes added by override: `[优]`, `[备]`
- Weights: [优]=2.0, [备]=0.5 (优 preferred 4x)
- Smart algorithm picks best performing with preference
- OneSmartPro uses 3 tiers: `'优:2;中:1;备:0.5'`

#### **8.2 Fallback Chain Pattern**

```yaml
- name: 高质量线路
  type: fallback
  proxies: [美国智能, 香港智能, 台湾智能, ..., 直接连接]
  url: 'https://www.google.com/generate_204'
  interval: 200
  lazy: true
```

**Semantics:**
- Try proxies in order
- Use first that passes health check
- Fallback to next on failure
- Used for feature grouping (HQ, LD, BW, LR)

#### **8.3 Load-Balance Distribution**

**Round-Robin:**
```yaml
- name: 香港均衡-轮询
  type: load-balance
  strategy: round-robin              # Next request → next proxy
  interval: 200
  lazy: true
  include-all: true
  filter: *FilterHK
```

**Consistent-Hashing:**
```yaml
- name: 香港均衡-散列
  type: load-balance
  strategy: consistent-hashing       # Same session → same proxy
  interval: 200
  lazy: true
  include-all: true
  filter: *FilterHK
```

#### **8.4 Filter Composition** (Merge.yaml)

Base templates that **inherit** exclude-filter:

```yaml
BaseGroupSelectRegion: &BaseGroupSelectRegion
  <<: *BaseGroupSelect
  include-all: true
  exclude-filter: *ProxyFilterGlobalExclude  # Automatically applied

# Usage:
- name: "香港节点"
  <<: *BaseGroupFastRegion           # Inherits exclude-filter
  filter: *BaseFilterRegionHK        # Additional positive filter
```

**Result:** Nodes must:
1. Match `BaseFilterRegionHK` (contain HK markers)
2. NOT match `ProxyFilterGlobalExclude` (no announcements)

---

### **9. Rules & Group References**

#### **9.1 Rule-to-Group Mapping** (MihomoPro.yaml rules)

```yaml
rules:
  # Domain-based rules
  - RULE-SET,Private,直接连接                # Private domains → DIRECT
  - RULE-SET,AI,人工智能                    # AI domains → 人工智能 group
  - RULE-SET,Telegram,电报消息              # Telegram → 电报消息 group
  - RULE-SET,Netflix,奈飞视频               # Netflix → 奈飞视频 group
  - RULE-SET,Streaming,国际媒体             # Streaming → 国际媒体 group
  - RULE-SET,Proxy,国外流量                 # Generic proxy → 国外流量 group
  - RULE-SET,China,国内流量                 # China → 国内流量 group
  
  # IP-based rules
  - RULE-SET,ChinaIP,国内流量,no-resolve    # China IPs → 国内流量
  - RULE-SET,ProxyIP,国外流量,no-resolve    # Foreign IPs → 国外流量
  
  # Final fallback
  - MATCH,兜底流量                          # Unmatched → 兜底流量 (catch-all)
```

**Group-to-Rule Flow:**
```
RULE-SET/Domain → Proxy-Group → Select proxies → Use proxy
```

---

### **10. Annotated YAML Snippets**

#### **10.1 Complete Regional Group Flow** (MihomoPro.yaml)

```yaml
# PROVIDER: All nodes labeled with prefix
优质服务商: 
  <<: *BaseProvider                   # Inherit: http, interval: 86400, health-check
  url: '优质订阅源地址'                # Your subscription URL
  override:
    additional-prefix: '[优] '        # All nodes from here → "[优] NodeName"

# FILTER ANCHOR: HK selector regex
FilterHK: &FilterHK '^(?=.*(?i)(港|🇭🇰|HK|Hong|HKG))(?!.*(排除1|排除2|5x)).*$'
#                   Positive lookahead ──┬──  Negative lookahead ──┬──
#                   Must contain HK       └─ Must NOT have exclusions

# TIER 1 - Master selector
- name: 香港策略                        # UI entry point
  type: select
  proxies:                            # Can choose between these sub-groups:
    - 香港自动                         # Tier 3: auto url-test
    - 香港均衡-散列                    # Tier 4: load-balance hashing
    - 香港均衡-轮询                    # Tier 4: load-balance robin
  include-all: true                   # Add ALL nodes from providers
  filter: *FilterHK                   # That match HK pattern
  icon: https://...Hong_Kong.png

# TIER 3 - Auto speed test (leaf)
- name: 香港自动
  <<: *BaseUT                         # type: url-test, interval: 200, lazy: true
  include-all: true                   # Load nodes from all providers
  filter: *FilterHK                   # Only HK region nodes
  icon: https://...Auto.png
  # Result: Pings all HK nodes; shows fastest

# TIER 4 - Load balance (leaf)
- name: 香港均衡-散列
  <<: *BaseCH                         # type: load-balance, strategy: consistent-hashing
  include-all: true
  filter: *FilterHK
  icon: https://...Round_Robin_1.png
  # Result: Distributes connections across HK nodes (same session → same proxy)

# APPLICATION RULE
rules:
  - RULE-SET,Streaming,国际媒体       # Stream domains → 国际媒体 group
  - MATCH,香港策略                    # Fallback → 香港策略 (if configured)
```

#### **10.2 Feature Group with Fallback** (OneSmartPro.yaml)

```yaml
# FALLBACK TIER - Line characteristic groups
- name: 低延迟线路
  <<: *BaseFB                         # type: fallback
  proxies:
    - 香港智能                         # Try HK first (lowest latency in region)
    - 台湾智能                         # Fallback to TW
    - 日本智能                         # Then JP
    - 狮城智能                         # Then SG
    - 韩国智能                         # Then KR
    - 美国智能                         # Then US
    - 欧洲智能                         # Then EU
    - 手动选择                         # Manual override
    - 直接连接                         # Last resort: DIRECT
  icon: https://...Round_Robin_1.png
  # Usage: For low-latency apps (gaming, video calls)
  # Logic: If HK down → try TW; if TW down → try JP, etc.

# REGIONAL SMART GROUP
- name: 香港智能
  <<: *BaseSmart                      # type: smart, uselightgbm: true
  filter: *FilterHK                   # Only HK nodes
  include-all: true                   # From all providers
  policy-priority: '优:2;中:1;备:0.5' # Weight by prefix
  # Result: Smart ML model selects best HK node, preferring [优] nodes

# APPLICATION LAYER
- name: 游戏平台
  <<: *SelectLD                       # Refers to: select type with 低延迟线路 in proxies list
  # When a game-traffic rule fires → 游戏平台 group
  # User sees: 低延迟线路, 高质量线路, etc. (other sub-groups)
  # If user selects "低延迟线路" → uses latency-optimized fallback chain
```

#### **10.3 Merge.yaml Complex Filter Composition**

```yaml
# Define:
ProxyFilterGlobalExclude: &ProxyFilterGlobalExclude 
  "^(?=.*(群|邀请|返利|...DirectAccess|移动网络|禁止下载|禁止视频)).*$"

ProxyFilterEdge: &ProxyFilterEdge >-  # Multi-line array
  ---
  `^((?=.*(高速|Fast|中转|CDN|ECDN))|(?!.*(专线|IPLC|固定IP|X5|5x)))(?=.*(🇭🇰|港)).*$`-
  `^((?=.*(高速|Fast|中转|CDN|ECDN))|(?!.*(专线|IPLC|固定IP|X5|5x)))(?=.*(🇹🇼|台湾)).*$`-
  `^((?=.*(高速|Fast|中转|CDN|ECDN))|(?!.*(专线|IPLC|固定IP|X5|5x)))(?=.*(🇺🇸|美国)).*$`-
  ---

BaseGroupSelectRegion: &BaseGroupSelectRegion
  <<: *BaseGroupSelect
  include-all: true
  exclude-filter: *ProxyFilterGlobalExclude  # Baked into template

# Usage:
- name: Auto-Edge
  <<: *BaseGroupBalanceRobin          # Inherits type: load-balance
  include-all: true
  filter: *ProxyFilterEdge            # Positive: CDN+fast nodes
  exclude-filter: *ProxyFilterGlobalExclude  # Negative: junk nodes
  # Result: Only high-bandwidth CDN nodes for streaming

- name: "AI"
  <<: *BaseGroupSelectPremium         # Inherits select + exclude-filter
  filter: *ProxyFilterPremium         # Positive: dedicated + US + TW
  icon: "...Rocket.png"
  # Result: Premium nodes in US or TW for AI services
```

---

### **11. Summary Table: Pattern Comparison**

| Aspect | YYDS (Pro/OneSmart) | Merge.yaml |
|--------|---|---|
| **Group Hierarchy** | 4-tier strict (Select → Feature → Auto → LB) | 2-3 tier flexible |
| **Filter Location** | Per-group filter + exclude-filter | Base templates inherit exclude-filter |
| **Filter Composition** | Single regex per group | Multi-regex arrays for complex logic |
| **Smart Groups** | type: smart with policy-priority | type: url-test or fallback |
| **Load-Balance** | Explicit per-region (hash + robin) | Grouped into feature categories |
| **Anchor Usage** | Heavy YAML anchors for templates | Very heavy; defines 20+ base patterns |
| **Config Size** | ~320 lines | ~550+ lines (includes define section) |
| **Complexity** | Beginner-friendly | Advanced users |

---

### **11a. Compact One-Liner Anchor Syntax** (666OS style)

All 666OS configs define group-type templates as compact inline YAML — each anchor fits on one line:

```yaml
# Group type templates (inline flow mapping)
BaseUT:    &BaseUT    {type: url-test,    interval: 200, lazy: true, url: 'https://www.google.com/generate_204'}
BaseFB:    &BaseFB    {type: fallback,    interval: 200, lazy: true, url: 'https://www.google.com/generate_204'}
BaseLB:    &BaseLB    {type: load-balance, interval: 200, lazy: true, url: 'https://www.google.com/generate_204'}
BaseCH:    &BaseCH    {type: load-balance, strategy: consistent-hashing, interval: 200, lazy: true, url: 'https://www.google.com/generate_204'}
BaseSmart: &BaseSmart {type: smart,       interval: 200, lazy: true, url: 'https://www.google.com/generate_204', hidden: true, uselightgbm: true}

# Region filter anchors (inline scalar)
FilterHK: &FilterHK '^(?=.*(?i)(港|🇭🇰|HK|Hong|HKG))(?!.*(排除1|排除2|5x)).*$'
FilterTW: &FilterTW '^(?=.*(?i)(台|🇹🇼|TW|TWN|Taiwan|TPE|TSA|KHH))(?!.*(排除)).*$'
FilterJP: &FilterJP '^(?=.*(?i)(日|🇯🇵|JP|Japan|NRT|HND|KIX|CTS|FUK))(?!.*(排除)).*$'
FilterSG: &FilterSG '^(?=.*(?i)(坡|🇸🇬|SG|Sing|SIN|XSP))(?!.*(排除)).*$'
FilterKR: &FilterKR '^(?=.*(?i)(韩|🇰🇷|韓|首尔|南朝鲜|KR|KOR|Korea|ICN))(?!.*(排除)).*$'
FilterUS: &FilterUS '^(?=.*(?i)(美|🇺🇸|US|USA|SJC|JFK|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD))(?!.*(排除)).*$'
FilterEU: &FilterEU '^(?=.*(?i)(奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱|意|拉|立|卢|马|荷|波|葡|罗|西|瑞典|英|🇩🇪|🇫🇷|🇬🇧|🇳🇱|🇸🇪|CDG|FRA|AMS|LHR|MUC)).*$'

# Resulting ultra-compact group definition (one line per group)
- {name: 香港智能,   <<: *BaseSmart, filter: *FilterHK, include-all: true, policy-priority: '优:2;中:1;备:0.5', icon: 'https://github.com/Koolson/Qure/raw/master/IconSet/Color/Hong_Kong.png'}
- {name: 香港自动,   <<: *BaseUT,    filter: *FilterHK, include-all: true, hidden: true}
- {name: 香港均衡-散列, <<: *BaseCH, filter: *FilterHK, include-all: true, hidden: true}
```

**Why one-liners matter for profile builder output:** YAML anchors with flow mappings keep generated configs readable and DRY — the profile builder should emit anchor definitions in the `define:` section header and reference them via `<<: *AnchorName` in group definitions.

---

### **Key Takeaways for Profile Builder**

1. **Provider Template Pattern**: All configs use single-level anchor inheritance with:
   - `type: http`, `interval: 86400`
   - `health-check: {enable: true, url: google_204, interval: 300}`
   - `filter`: Negative lookahead excluding keywords

2. **Regional Group Pattern**: 
   - Name format: `[emoji] [region-name-zh]`
   - Always include: `include-all: true, filter: [region-regex]`
   - Sub-structure: Select → (Auto-test, LB-hash, LB-robin)

3. **Filter Regex Patterns**:
   - **Positive** (inclusion): `^(?=.*(marker1|marker2))` 
   - **Negative** (exclusion): `(?!.*(bad1|bad2))`
   - Combine: `^(?=.*(good))(?!.*(bad)).*$`

4. **Smart Group Parameters**:
   - `type: smart` with `policy-priority` for weighted provider selection
   - `uselightgbm: true` enables ML-based latency optimization
   - `interval: 200` for quick updates

5. **Group Referencing**:
   - `proxies:` lists explicit group/proxy names
   - `include-all: true` + `filter:` adds dynamic nodes
   - `use: [provider_name]` limits to specific providers

This architecture enables automatic regional selection, provider redundancy, and performance-based optimization with minimal manual configuration.
