# Proxy Provider Patterns

Synthesized from: `vendor/666OS/YYDS/mihomo/config/MihomoPro.yaml`, `OneSmartPro.yaml`, `vendor/Merge.yaml`.
See also: `docs/proxy-group-patterns.md` for the group-side usage of providers.

---

## 1. Base Provider Template

All configs share a single `BaseProvider` anchor inherited by every subscription entry:

```yaml
BaseProvider: &BaseProvider
  type: http                          # HTTP subscription source (only type in practice)
  interval: 86400                     # 24-hour refresh interval
  proxy: DIRECT                       # Fetch subscription via direct connection
  health-check:
    enable: true
    url: 'https://www.google.com/generate_204'  # CONNECT test endpoint
    interval: 300                     # Check every 5 minutes
  filter: '^(?!.*(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)).*$'
```

Per-subscription entries merge via `<<: *BaseProvider` and add only the URL:

```yaml
优质服务商: {<<: *BaseProvider, url: 'https://airport.example.com/sub?token=xxx'}
备用服务商: {<<: *BaseProvider, url: 'https://backup.example.com/sub?token=xxx'}
```

---

## 2. Provider-Level Filter

The `filter` field on a provider is a **negative lookahead** that strips unwanted nodes the moment the subscription loads. This is the right place to strip junk — apply it once here, not repeated on every group.

```yaml
# Pattern: ^(?!.*(keyword1|keyword2|...)).*$
# Meaning: include only nodes whose name does NOT contain any of these keywords
filter: '^(?!.*(群|邀请|返利|循环|官网|...)).*$'
```

What it strips: announcement nodes, affiliate invites, traffic counters, expired-notice lines, setup-instructions nodes, support/contact entries.

---

## 3. Node Prefix Tagging (`override.additional-prefix`)

When running multiple subscription tiers, tag each provider's nodes with a prefix. This enables downstream `policy-priority` weighting in `smart` groups and makes node origin visible in the dashboard.

```yaml
优质服务商:
  <<: *BaseProvider
  url: 'https://premium.example.com/sub'
  override:
    additional-prefix: '[优] '    # All nodes: "[优] NodeName"

备用服务商:
  <<: *BaseProvider
  url: 'https://backup.example.com/sub'
  override:
    additional-prefix: '[备] '    # All nodes: "[备] NodeName"

落地服务商:
  <<: *BaseProvider
  url: 'https://landing.example.com/sub'
  override:
    additional-prefix: '[中] '    # All nodes: "[中] NodeName"
    dialer-proxy: 中转服务        # Route this subscription fetch through a relay group
```

**Tier naming convention** (from 666OS/OneSmartPro):
| Prefix | Meaning | `policy-priority` weight |
|--------|---------|--------------------------|
| `[优]` | Premium / dedicated lines | `2` |
| `[中]` | Mid-tier / relay | `1` |
| `[备]` | Backup / fallback | `0.5` |

`policy-priority` is a `smart` group feature (vernesong fork only). Format: `'优:2;中:1;备:0.5'` — the smart group matches node names against these keywords and weights accordingly.

---

## 4. One Provider Per Tier, Not Per Region

**✅ Correct:** one provider per subscription tier; use group `filter` to split regions.

```yaml
proxy-providers:
  优质服务商: {<<: *BaseProvider, url: '...', override: {additional-prefix: '[优] '}}
  备用服务商: {<<: *BaseProvider, url: '...', override: {additional-prefix: '[备] '}}

proxy-groups:
  - {name: 香港自动, type: url-test, include-all: true, filter: *FilterHK}
  - {name: 日本自动, type: url-test, include-all: true, filter: *FilterJP}
```

**❌ Wrong:** one provider per region — combinatorial explosion, brittle when airports reorganize nodes.

```yaml
proxy-providers:
  香港服务商: {<<: *BaseProvider, url: '...hk...'}
  日本服务商: {<<: *BaseProvider, url: '...jp...'}
  # ... 7+ providers for the same subscription
```

---

## 5. `use:` vs `include-all` on Groups

| Field | Scope | Use when |
|---|---|---|
| `include-all: true` | All providers | Most groups — pulls from every provider, then filters |
| `use: [provider_name]` | Named provider(s) only | Relay/landing groups that must use a specific tier |

```yaml
# Relay group: only use the landing-tier provider
- name: 中转服务
  type: load-balance
  strategy: consistent-hashing
  use: [落地服务商]         # Only nodes from this specific provider
  filter: 'HK|TW'          # Further filter to HK or TW nodes
  hidden: true
```
