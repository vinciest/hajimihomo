# Roadmap Brainstorm

Prioritized ideas for hajimihomo optimization and features, informed by
ecosystem peers (ACL4SSR, Loyalsoldier/clash-rules, subconverter,
sub-store, blackmatrix7/ios_rule_script, Clash Verge, FlClash).

---

## P0 — High-impact, low-effort

### 1. Incremental builds
Currently `build.py` re-fetches and re-resolves all 664 atomics + 24 groups
every run. A content-hash cache (store SHA-256 of each fetched source in
`dist/.cache/`) would let the builder skip unchanged categories entirely.
blackmatrix7's own repo uses a similar approach — only categories whose
upstream files changed get rebuilt.

**Impact:** CI build time from ~3min → ~30s on typical day (most sources
don't change daily). Local `make build-groups` becomes near-instant.

### 2. Share-profile URL
Encode profile options (preset, kernel, features, sub URLs) as a URL hash
fragment (`#p=standard&t=mihomo&f=ads,tracking&s=https://...`). The web
app reads the hash on load and auto-fills the form. This is the #1
requested feature in similar tools (sub-store, SubConverter web UI).
Users can share a single link that produces an identical profile.

**Impact:** Massive UX improvement for sharing configs with non-technical
users. No backend needed — everything is client-side.

### 3. Download button with proper filename
Auto-name the downloaded file `hajimihomo-{preset}-{kernel}.yaml` instead
of a generic name. Include a copy-to-clipboard button. Small change, high
polish.

### 4. Estimated rule count + file size
Before generating, show "≈12,400 rules, ~280KB" so users understand the
weight of their selection. subconverter does this. Helps users decide
between Tier 1 (all-in-one) and Tier 2 (split) formats.

---

## P1 — High-impact, medium-effort

### 5. Import existing config
Let users paste their current mihomo YAML. The app parses it to extract
subscription URLs and group selections, then pre-fills the builder form.
Clash Verge and FlClash both support this "paste config" workflow. The
parser only needs to extract `proxy-providers[].url` and `proxy-groups[].name`
— not full config validation.

### 6. Source freshness dashboard
Track when each upstream source was last fetched and whether it changed.
Display in a small admin panel or as a CI artifact. ACL4SSR and
blackmatrix7 both surface this info. Helps identify stale or broken
upstream sources early.

**Implementation:** `build.py` already fetches every source. Add a
`source-meta.json` output with `{category: {url, last_fetch, etag, sha256}}`.

### 7. Subscription URL health check
Before generating, ping each subscription URL and report status
(reachable, expired, traffic exceeded). sub-store does this extensively.
The check can be a simple HEAD request + response code — no need to
download the full subscription body.

**Note:** CORS prevents browser-side checks for most subscription
endpoints. Would need a CORS proxy or be CLI-only. Start with CLI.

### 8. Preset save/load (localStorage)
Let users save their customized configuration (kernel, features, selected
groups, sub URLs) to localStorage and reload it later. SimpleMode already
has presets — this extends it to user-defined ones. sub-store uses
localStorage extensively for this.

### 9. Multi-language UI
Currently Chinese-only. Add English labels alongside Chinese (or a
language toggle). The i18n surface is small (~50 strings). This would
make the tool accessible to the broader mihomo/Clash Meta community
(which includes significant non-Chinese users in Southeast Asia, Middle
East, and South America).

---

## P2 — Medium-impact, medium-effort

### 10. TypeScript strict mode for ProfileBuilder
`ProfileBuilder.ts` currently has `@ts-nocheck`. The 800-line file has
complex logic with implicit `any` types throughout. Gradual strict-mode
adoption (start with `strict: false, noImplicitAny: true`) would catch
real bugs — especially in the anchor/group-building logic where a typo
in a key name silently produces wrong output.

### 11. Integration tests against mihomo parser
Current tests validate generated YAML with `js-yaml` (syntax check).
Adding a test that feeds the output into mihomo's actual config parser
(via a Go subprocess or the mihomo HTTP API) would catch semantic errors
that `js-yaml` misses — like invalid anchor merges, wrong key names, or
unsupported field combinations.

### 12. Python source caching (HTTP ETags)
`parse.py` fetches sources via `urllib.request` with no caching. Adding
ETag/If-Modified-Since support (store in `.cache/` per source URL) would
cut build time and upstream bandwidth. The CI daily cron would benefit
most — most sources don't change between runs.

### 13. Build diff report
`stats.py` already compares build metadata. Extend it to produce a
human-readable diff: "proxy/telegram grew by 47 rules, block/ads lost
3 rules, new category Foo was added." Publish as a CI comment on the
build workflow. Loyalsoldier's repo does something similar.

### 14. Config template gallery
Community-shared preset configurations. Users can export their config
options as a JSON snippet, share it (via GitHub Gist or a dedicated
repo), and others can import it. Think "awesome mihomo configs" with
one-click apply.

**Implementation:** URL hash encoding (idea #2) is the import/export
mechanism. A curated list in `docs/templates/` or a wiki page is the
gallery.

---

## P3 — Lower-priority / longer-term

### 15. sing-box config generation (full)
Currently the builder emits sing-box rule-set files (.json) but the
profile generator only outputs mihomo YAML. A full sing-box config
generator (with route rules, dns, inbounds, outbounds) would serve
the growing sing-box user base. The `singbox.json` base config in
`profiles/defaults/` is already stubbed.

### 16. Rule conflict detection
Detect overlapping rules across groups (e.g., `DOMAIN-SUFFIX,google.com`
in both proxy/google and direct/cn). This is a source-level validation
enhancement. subconverter has basic overlap detection.

### 17. Proxy node region auto-tagging
Given a subscription URL, fetch the proxy list and auto-classify nodes
by region using the same filter patterns from `filter-anchors.yaml`.
Display in the UI so users can see "you have 5 HK nodes, 3 JP nodes"
before generating. This would help users understand their topology
options.

**Note:** Requires CORS proxy or CLI mode. Complex — defer until
the core builder is mature.

### 18. Automated dependency updates
Add Renovate or Dependabot for `web/package.json`. Currently no
automated update mechanism. Low priority since deps are minimal
(preact, eta, daisyui) and stable.

### 19. CDN fallback
jsDelivr is the sole CDN. Add a fallback (e.g., unpkg, or a
self-hosted mirror) for users in regions where jsDelivr is blocked.
The generated profiles already use jsDelivr URLs — a fallback would
need the profile builder to offer a CDN selector.

### 20. Vendor coverage visualization
`vendor-coverage.py` already generates a coverage report. Turn it
into an interactive web page that shows which blackmatrix7 categories
are covered, which are missing, and which are intentionally excluded.
Useful for maintainers auditing source coverage.

---

## Ecosystem peers reference

| Project | What hajimihomo can learn |
|---|---|
| **ACL4SSR** | Simple template-based config generation; community preset sharing via GitHub |
| **Loyalsoldier/clash-rules** | Clean rule categorization; well-documented README with usage examples |
| **blackmatrix7/ios_rule_script** | Upstream source freshness; multi-format output (Clash/Surge/QuantumultX) |
| **subconverter** | Subscription format conversion; rule count estimation; web UI with form-based config |
| **sub-store** | Subscription management UI; health checking; localStorage persistence; import/export |
| **Clash Verge** | Config import from file/clipboard; subscription management; TUN toggle |
| **FlClash** | Mobile-first UI patterns; QR code sharing; one-tap profile application |
| **MetaCubeX/meta-rules-dat** | Geodata publishing patterns; release automation |

---

## Ecosystem deep-dive findings

Research from shallow-cloning and inspecting 6 peer repos.

### SukkaW/Surge (4,149 ★) — TypeScript rule-set builder

The closest architectural peer to hajimihomo. Key patterns worth studying:

- **Writing strategy pattern.** `Build/lib/writing-strategy/base.ts` defines an
  abstract `BaseWriteStrategy` with format-specific subclasses (Surge, Clash,
  AdGuard Home, sing-box, legacy Clash Premium). Each strategy implements
  `writeDomain()`, `writeDomainSuffix()`, `writeIpCidrs()`, etc. This is cleaner
  than hajimihomo's approach of separate `convert/mihomo.py` and
  `convert/singbox.py` modules with duplicated logic. A strategy pattern would
  make adding new output formats (Loon, Stash, Surfboard) mechanical.

- **Trie-based domain deduplication.** Uses `HostnameSmolTrie` and `HostnameTrie`
  data structures to detect redundant domain rules (e.g., `example.com` subsumes
  `sub.example.com`). hajimihomo's `parse.py` has no dedup — categories with
  overlapping upstream sources will emit duplicate rules. This is a concrete
  optimization for rule-set size.

- **Stream processing.** Uses `TransformStream` for line-by-line parsing of large
  rule files, avoiding loading entire files into memory. hajimihomo's `parse.py`
  reads entire files into lists. For the largest sources (10K+ rules), streaming
  would reduce memory pressure in CI.

- **Magic command headers.** Source files embed metadata via comments:
  `# $ meta_title Ads`, `# $ meta_description Ad-blocking rules`. This is a
  lightweight alternative to external metadata files.

- **Incremental output.** `compareAndWriteFile()` only writes when content
  actually changed, avoiding unnecessary git diffs and CDN purges.

- **Performance tracing.** Parent-child span system for timing each build step.
  Useful for identifying bottlenecks in the 664-category build.

### subconverter (C++ with QuickJS) — Subscription converter

- **Rule source registry.** `scripts/rules_config.conf` defines upstream sources
  with regex match patterns: `match=Clash/*.list|Clash/Ruleset/**`. Similar to
  hajimihomo's `categories.yaml` but more flexible for glob-based source
  discovery.

- **Scripting engine.** Embeds QuickJS for user-defined proxy node transformations
  (rename, emoji, filtering). hajimihomo's profile builder has no scripting — all
  transformations are hardcoded in TypeScript.

- **Multi-format output.** Supports Clash, Surge, QuantumultX, Loon, Stash from
  a single rule pipeline. hajimihomo only targets mihomo and sing-box.

### Sub-Store — Subscription management platform

- **Script pipeline.** `backend/src/` has a modular script system:
  `media-filter.js`, `tls-fingerprint.js`, `ip-flag.js`, `udp-filter.js`,
  `fancy-characters.js`. Each script is a standalone transform applied to proxy
  nodes. This plugin architecture would let hajimihomo users add custom rule
  transforms.

- **Multi-client config.** Ships config files for Surge (.sgmodule), Loon
  (.plugin), Stash (.stoverride), QuantumultX (.snippet), Egern (.yaml). The
  profile builder could similarly output client-specific wrapper configs.

- **RESTful backend.** Has a full Express.js REST API for subscription CRUD.
  Overkill for hajimihomo, but the subscription health-check pattern (fetch sub
  URL, parse nodes, report status) is directly applicable.

### ACL4SSR — Rule lists (no build system)

- Raw `.list` files in `Clash/` directory, no compilation step. Demonstrates that
  many users just want simple, flat rule files — not complex split hierarchies.
  hajimihomo's Tier 1 (all-in-one) output serves this audience.

### Loyalsoldier/clash-rules (26,948 ★) + v2ray-rules-dat (19,973 ★)

- **clash-rules**: README-only repo. Rules are published via GitHub Actions to
  releases. No source files in the repo — it's purely a distribution channel.
  Shows that documentation quality drives adoption more than code sophistication.

- **v2ray-rules-dat**: Has Python build scripts for geodata generation
  (geoip.dat, geosite.dat). Uses a similar pattern to hajimihomo's `build.py` —
  fetch sources, process, emit output files. The geodata build is a reference for
  hajimihomo's potential geodata publishing feature (P3 #15).

### Patterns not yet in hajimihomo

| Pattern | Source | Difficulty | Value |
|---|---|---|---|
| Writing strategy for multi-format | SukkaW/Surge | Medium | Enables Loon/Stash/Surfboard output |
| Trie-based domain dedup | SukkaW/Surge | Medium | 5-15% smaller rule sets |
| Stream processing for large sources | SukkaW/Surge | Low | Lower CI memory, faster parsing |
| Incremental output (skip unchanged) | SukkaW/Surge | Low | Cleaner git diffs, less CDN churn |
| Performance tracing spans | SukkaW/Surge | Low | Identify build bottlenecks |
| Script pipeline for rule transforms | Sub-Store | High | User-extensible rule processing |
| Multi-client config output | Sub-Store | Medium | Broader user base |
| Subscription health checking | Sub-Store | Medium | Better UX for sub URL management |
