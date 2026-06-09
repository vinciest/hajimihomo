# AGENTS.md

## Project Overview

**hajimihomo** is a mihomo/Clash Meta ruleset build system. It aggregates proxy routing rules from multiple upstream sources (primarily [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)), resolves them into clean rule sets, and publishes them to CDN branches for use in proxy clients.

Two deliverables:
1. **Rule sets** — built by `scripts/build.py`, published to `dist/` and CDN branches. Each group produces multiple output files per format tier.
2. **Interactive profile builder** — a static web app (`web/`) deployed to GitHub Pages that lets users generate complete, standalone mihomo config files.

**Key technologies:** Python 3 · PyYAML · Bun · TypeScript · Preact · DaisyUI · eta · GitHub Actions · jsDelivr CDN

**Branch model:**
- `dev` — all source edits, PRs, CI builds
- `ruleset` (auto-managed) — published text rule sets (`dist/mihomo/*.yaml`, `dist/singbox/*.json`)
- `release` (auto-managed) — compiled binaries (`.mrs`, `.srs`)
- `gh-pages` (auto-managed) — profile builder web app

---

## Setup

```bash
pip install pyyaml              # Python 3.12+, only dep needed
make web-install                # cd web && bun install (Bun >= 1.x)
make vendor-sync                # clone/update upstream repos into vendor/ (gitignored)
```

Vendor repos are required for source extraction and coverage analysis, but not for building (build fetches sources via HTTP).

---

## Source Structure

```
source/
  categories.yaml   # 664 leaf categories — each maps to upstream rule sources
  catalog.yaml      # 24 policy groups — semantic bundles of leaf categories
  overrides/        # local override lists (override: prefix = replace source entirely)
  hosts/            # DNS pollution data for hosts block generation

profiles/
  presets/          # 1-mini / 2-lite / 3-standard / 4-full preset definitions (YAML)
  defaults/         # config section files — static YAML and eta templates

web/src/
  ProfileBuilder.ts       # core generation engine — pure browser-safe TS, no Node APIs
  catalog.ts              # data layer: presets, group index, lazy categories loader
  App.tsx                 # root Preact component
  components/             # UI components (Preact + DaisyUI)
  ProfileBuilder.test.ts  # regression tests (bun test)

scripts/
  build.py              # main rule-set builder
  validate.py           # source YAML validation
  extract_sources.py    # re-extracts sources from blackmatrix7 vendor
```

Full source tree, field schemas, dist output tiers, and profile builder UI reference: [docs/source-config.md](docs/source-config.md).

---

## Development Workflow

### Rule-set builder

```bash
make build                           # build atomics + all catalog groups (CI mode)
make build-groups                    # catalog groups only (skips 664 atomics)
make build-groups GROUPS=proxy/telegram,block/ads   # specific groups only
make build-dry                       # dry-run: validate graph, no file output
make validate                        # validate source/categories.yaml + catalog.yaml
make extract                         # re-extract sources from bm7 vendor
make extract-check                   # check coverage gaps vs bm7 without writing
```

### Profile builder (web)

```bash
make dev            # Bun dev server at http://localhost:5173 (uses CDN rulesets)
make dev-local      # dev server using local dist/ instead of CDN
make web-build      # production build → web/dist/
cd web && bun test  # run ProfileBuilder regression tests
```

### Profile builder (CLI)

```bash
make profile                         # builds standard preset → dist/profiles/standard.yaml
make profile PRESET=full             # specific preset (mini|lite|standard|full)
make cli-build                       # compile Bun binary → bin/hajimihomo
make generator                       # build dist/generator.js (browser ESM)
make generator-cli                   # build dist/generator-cli.js (Bun CLI bundle)
```

---

## Source Config Editing

### `source/categories.yaml`

Each entry is a leaf category:

```yaml
CategoryName:
  type: domain      # domain | ip | mixed | unknown
  sources:
    - repo:blackmatrix7/ios_rule_script/master/rule/Clash/CategoryName/CategoryName.list
  appends: []       # extra rules added on top
  removes: []       # rules removed from resolved set
  override:filename # prefix: replaces source entirely with local overrides/filename
```

### `source/catalog.yaml`

Defines the 24 policy groups. Key fields: `name`, `default_action`, `members` (leaf category names), `excludes`, `members_ref` (union another group), `excludes_ref`.

After editing catalog.yaml, rebuild with `make build-groups` to verify resolution.

### Adding / Modifying Rules

1. **New category**: add entry to `source/categories.yaml` with sources.
2. **New policy group**: add entry to `source/catalog.yaml` with members.
3. **Override a source entirely**: create `source/overrides/<filename>`, set `override:filename` on the category.
4. **Validate**: `make validate` then `make build-dry`.
5. **Build**: `make build-groups` (faster than full build for catalog changes).

---

## Web Profile Builder

### Generation engine architecture

```
source/catalog.yaml ─── Bun plugin ──→ bundled into app chunk (catalog-index)
profiles/presets.yaml ─ Bun plugin ──→ bundled into app chunk (presets)
source/categories.yaml ─ gen-data.ts → dist/categories-index.json (fetched lazily)

web/src/ProfileBuilder.ts  (pure browser TS, no Node APIs)
  └─ exported via generator-exports.ts → dist/generator.js (browser ESM ~34KB)
       └─ loaded by web app via importmap: "hajimihomo-generator" → "./generator.js"
       └─ dynamically imported on first Generate click (preloaded in background)

web/cli.ts (Node APIs: fs, path, readline)
  └─ imports ProfileBuilder.ts directly (no bundling at dev time)
  └─ bundles as dist/generator-cli.js (--target bun, self-contained)
```

**Key constraint:** `ProfileBuilder.ts` must have zero Node.js API imports. It is the shared engine used in both the browser and the Bun CLI. All file I/O and stdin interaction lives only in `cli.ts`.

### Modifying generated profile output

- **Static config sections** (DNS, sniffer, TUN): edit files in `profiles/defaults/*.yaml`
- **Dynamic config sections** (core keys, geodata URLs, profile flags): edit `profiles/defaults/*.yaml.eta` (eta templates)
- **YAML anchors**: edit `profiles/defaults/*-anchors.yaml` — anchor names like `&ProxyProvider`, `&GroupSelect` are embedded verbatim in the string output
- **Generation logic** (group building, rule ordering, format switching): edit `web/src/ProfileBuilder.ts`
- **After any change**: run `cd web && bun test` to verify YAML output is still parseable

**eta template gotcha:** `new Eta({ autoEscape: false, autoTrim: false })` — both options are required. Default `autoTrim: 'nl'` strips newlines after `<%= %>` tags and collapses YAML multiline values onto one line (invalid YAML).

---

## CI / CD

All CI targets `dev` branch. Workflows:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | push to `dev` (source/scripts), daily cron 19:00 UTC | Build rule sets, push to `ruleset` branch, compile binaries, push to `release` branch, purge CDN |
| `pages.yml` | push to `dev` (web/) | Build web app, deploy to `gh-pages` |
| `validate.yml` | PR to `dev` (source/) | Run `scripts/validate.py` |

CI Python: 3.12 + `pyyaml` only. Never import `jinja2`, `ruamel.yaml`, or `requests`.

---

## Naming Conventions

- **Catalog group IDs**: slash-separated tiers — `block/ads`, `proxy/apple`, `meta/cn`
- **Dist file stems**: slashes replaced with dashes — `proxy-apple.domain.yaml`, `proxy-apple.ip.yaml`
- **Rule-provider keys** in generated profiles: same as dist stem (e.g. `proxy-apple`, `proxy-apple-ip`)
- **Category names**: PascalCase matching blackmatrix7 naming — `Apple`, `GoogleDrive`, `AdvertisingLite`
- **Preset files**: numbered prefix for sort order — `1-mini.yaml`, `2-lite.yaml`, `3-standard.yaml`, `4-full.yaml`

---

## Common Gotchas

- **Gitignored paths** — `dist/`, `vendor/`, `web/src/styles.css`, `web/dist/categories-index.json` are all gitignored. CDN branches are push-only from CI.
- **No `src/data/` or `src/generated/` folder** — catalog-index and presets are transformed inline by the Bun plugin. Only `categories-index.json` is written to disk (in `dist/`, not `src/`).
- **YAML anchors are plain text**: `js-yaml`'s `dump()` never emits named anchors. All anchor definitions and merge keys are output as literal strings via `profiles/defaults/*-anchors.yaml` and TS string builders.
- **Rule ordering is critical**: in generated profiles, `direct/cn` domain rules MUST precede proxy service domain rules. Changing rule order in `ProfileBuilder.ts` can cause CN traffic to leak through proxy.
- **Block groups use named selects, not direct REJECT**: rules never hardcode `REJECT` as a target. Instead, block groups use a select group containing [REJECT, DIRECT, default proxy], allowing dashboard-level toggle.
- **`smart` group type** is NOT in official MetaCubeX/mihomo — it exists only in the `vernesong/mihomo` fork.
- **Unquoted colon-space in YAML strings** is parsed as a nested mapping. Strings containing `: ` must be single-quoted in generated YAML output.

---

## Pull Request Guidelines

- All PRs target `dev` branch.
- For source changes: run `make validate` and `make build-dry` before opening a PR.
- For web changes: run `make web-build` and `cd web && bun test` to confirm build and tests pass.
- Commit message format: `type(scope): description` — e.g. `feat(catalog): add proxy/finance group`, `fix(build): correct ip-resolve ordering`.
- Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer on AI-assisted commits.
