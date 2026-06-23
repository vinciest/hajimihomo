// @ts-nocheck — run with `bun run dev.ts`
// Set RULESET_DIR env var to serve rulesets from a local build output:
//   RULESET_DIR=../dist bun run dev.ts
import { plugin } from 'bun'
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import { resolve } from "node:path";
import yaml from 'js-yaml'
import { buildCatalogIndex, buildPresetsIndex, buildCategoriesIndex } from "./data-transforms";
import { yamlB64Plugin } from "./src/plugins/yaml-b64";
import { buildFullProfile } from "./src/ProfileBuilder";

// Register plugin BEFORE loading index.html so Bun processes catalog.ts YAML imports correctly
// Uses onResolve+namespace to ensure plugin takes precedence over Bun's native YAML loader.
const CATALOG_PATH  = resolve(import.meta.dir, '../source/catalog.yaml')
const PRESETS_PATH  = resolve(import.meta.dir, '../profiles/presets.yaml')

plugin({
  name: 'source-yaml',
  setup(build) {
    build.onResolve({ filter: /source\/catalog\.yaml$/ },   () => ({ path: CATALOG_PATH,  namespace: 'source-yaml' }))
    build.onResolve({ filter: /profiles\/presets\.yaml$/ }, () => ({ path: PRESETS_PATH,  namespace: 'source-yaml' }))
    build.onLoad({ filter: /catalog\.yaml$/,  namespace: 'source-yaml' }, async ({ path }) => {
      const text = await Bun.file(path).text()
      return { contents: JSON.stringify(buildCatalogIndex(text)), loader: 'json' }
    })
    build.onLoad({ filter: /presets\.yaml$/, namespace: 'source-yaml' }, async ({ path }) => {
      const text = await Bun.file(path).text()
      return { contents: JSON.stringify(buildPresetsIndex(text)), loader: 'json' }
    })
  }
})

plugin(yamlB64Plugin)

plugin({
  name: 'hajimihomo-generator',
  setup(build) {
    build.onResolve({ filter: /^hajimihomo-generator$/ }, () => ({
      path: resolve(import.meta.dir, 'src/ProfileBuilder.ts'),
    }))
  }
})

// Generate dist/categories-index.json for browser fetch
const root = resolve(import.meta.dir, '..')
const categoriesYaml = await readFile(resolve(root, 'source/categories.yaml'), 'utf8')
const catalogYaml    = await readFile(resolve(root, 'source/catalog.yaml'),    'utf8')
const categoriesIndexData = buildCategoriesIndex(categoriesYaml, catalogYaml)
const distDir = resolve(import.meta.dir, 'dist')
await mkdir(distDir, { recursive: true })
await writeFile(resolve(distDir, 'categories-index.json'), JSON.stringify(categoriesIndexData))

// Build generator.js so the importmap can resolve it in the browser
let lastGenVersion = 0

async function buildGenerator(label = 'startup') {
  const result = await Bun.build({
    entrypoints: [resolve(import.meta.dir, 'src/generator-exports.ts')],
    target: 'browser',
    format: 'esm',
    plugins: [yamlB64Plugin],
  })
  if (result.success) {
    await writeFile(resolve(distDir, 'generator.js'), await result.outputs[0].arrayBuffer())
    lastGenVersion++
    console.log(`🔄 generator.js rebuilt (${label}) #${lastGenVersion}`)
  } else {
    console.warn('⚠️  generator.js build failed:', result.logs)
  }
}

await buildGenerator('startup')

// Load index.html AFTER plugin registration
const { default: index } = await import('./index.html')

const rulesetDistDir = process.env.RULESET_DIR
  ? resolve(import.meta.dir, process.env.RULESET_DIR)
  : null;
const rulesetDir = rulesetDistDir ? resolve(rulesetDistDir, "mihomo") : null;
const localRulesetsJson = rulesetDistDir
  ? await readFile(resolve(rulesetDistDir, "rulesets.json"), "utf8").catch(() => null)
  : null;

const CDN_RULESET = "https://cdn.jsdelivr.net/gh/cest-la-v/hajimihomo@ruleset/mihomo";

// ── Dev subscription endpoint ─────────────────────────────────────────────────
const DEV_CONFIG_PATH = resolve(import.meta.dir, '.dev.yaml')
const PRESETS_FILE = resolve(import.meta.dir, '../profiles/presets.yaml')

interface DevConfig {
  preset?: string
  subs?: string[]
  groups?: string[]
  dns?: Record<string, any>
  overrides?: Record<string, any>
}

let devConfigCache: { mtime: number; config: DevConfig | null } | null = null

async function loadDevConfig(): Promise<DevConfig | null> {
  try {
    const file = Bun.file(DEV_CONFIG_PATH)
    const mtime = file.lastModified
    if (devConfigCache && devConfigCache.mtime === mtime) return devConfigCache.config
    const raw = await file.text()
    const config = yaml.load(raw) as DevConfig | null
    devConfigCache = { mtime, config }
    return config
  } catch {
    return null
  }
}

async function serveRulesetFile(pathname) {
  if (rulesetDir) {
    const content = await readFile(resolve(rulesetDir, pathname), "utf8").catch(() => null);
    if (content) {
      const ct = pathname.endsWith(".json") ? "application/json" : "text/plain";
      return new Response(content, { headers: { "Content-Type": ct } });
    }
  }
  return fetch(`${CDN_RULESET}/${pathname}`);
}

// ── Tailwind CSS watcher ──────────────────────────────────────────────────────
Bun.spawn(['./node_modules/.bin/tailwindcss', '-i', 'src/input.css', '-o', 'src/styles.css', '--watch'], {
  stdout: 'inherit', stderr: 'inherit', cwd: import.meta.dir,
})

Bun.serve({
  routes: {
    "/": index,
    "/styles.css": () => new Response(Bun.file(resolve(import.meta.dir, 'src/styles.css')), {
      headers: { 'Content-Type': 'text/css; charset=utf-8' },
    }),
    "/categories-index.json": () => new Response(Bun.file(resolve(distDir, 'categories-index.json')), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    "/generator.js": () => new Response(Bun.file(resolve(distDir, 'generator.js')), {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    }),
    // SSE: notify browser when generator.js is rebuilt
    "/__hmr": () => new Response(
      async function* () {
        let lastSent = lastGenVersion
        while (true) {
          if (lastGenVersion !== lastSent) {
            lastSent = lastGenVersion
            yield `data: ${lastGenVersion}\n\n`
          }
          await Bun.sleep(1000)
        }
      }(),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } },
    ),
    // Always intercept /ruleset/mihomo/* — local file or CDN proxy
    "/ruleset/mihomo/rulesets.json": () =>
      localRulesetsJson
        ? new Response(localRulesetsJson, { headers: { "Content-Type": "application/json" } })
        : fetch(`${CDN_RULESET}/rulesets.json`),
    "/ruleset/mihomo/*": (req) => {
      const pathname = new URL(req.url).pathname.replace("/ruleset/mihomo/", "");
      return serveRulesetFile(pathname);
    },
    // Dev subscription — serves generated profile with localhost rule URLs
    "/sub": async (req) => {
      const config = await loadDevConfig()
      if (!config) {
        return new Response(
          '# No .dev.yaml found. Copy .dev.yaml.example → .dev.yaml and configure.\n',
          { status: 404, headers: { 'Content-Type': 'text/yaml' } },
        )
      }

      // Load preset
      const presetsRaw = yaml.load(await readFile(PRESETS_FILE, 'utf8')) as any
      const preset = (presetsRaw?.presets || presetsRaw)?.[config.preset || 'standard'] || {}

      // Load catalog
      const catalogPath = rulesetDistDir
        ? resolve(rulesetDistDir, 'rulesets.json')
        : resolve(root, 'dist/rulesets.json')
      const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))

      // Build group list (explicit config groups > preset groups)
      const groupIds: string[] = config.groups || preset.groups || []

      // Generate profile
      const opts = {
        topology: preset.topology,
        target:   preset.target || 'mihomo',
        features: preset.features || {},
        dns:      config.dns || {},
      }
      let profile = buildFullProfile(config.subs || [], groupIds, catalog, opts)

      // Rewrite CDN URLs → localhost
      const localBase = `http://localhost:5173`
      const CDN_BASE_LOCAL = 'https://cdn.jsdelivr.net/gh/cest-la-v/hajimihomo'
      profile = profile
        .replaceAll(`${CDN_BASE_LOCAL}@ruleset/mihomo/`, `${localBase}/ruleset/mihomo/`)
        .replaceAll(`${CDN_BASE_LOCAL}@ruleset/`, `${localBase}/ruleset/`)

      // Apply user overrides (same logic as cli.ts)
      if (config.overrides) {
        const ov = config.overrides
        if (Array.isArray(ov.prepend_rules) && ov.prepend_rules.length) {
          const rulesIdx = profile.indexOf('\nrules:\n')
          if (rulesIdx !== -1) {
            const insertPos = rulesIdx + '\nrules:\n'.length
            const ruleLines = ov.prepend_rules.map((r: string) => `  - ${r}`).join('\n') + '\n'
            profile = profile.slice(0, insertPos) + ruleLines + profile.slice(insertPos)
          }
        }
        if (Array.isArray(ov.extra_rules) && ov.extra_rules.length) {
          const ruleLines = '\n' + ov.extra_rules.map((r: string) => `  - ${r}`).join('\n')
          profile = profile.replace(/(  - MATCH,🐟 漏网之鱼)$/, `$1${ruleLines}`)
        }
        for (const [key, val] of Object.entries(ov)) {
          if (key === 'prepend_rules' || key === 'extra_rules') continue
          if (val != null) {
            const dumped = yaml.dump(val, { lineWidth: -1, noRefs: true, indent: 2 }).trimEnd()
            const indented = dumped.split('\n').map((line: string) => `  ${line}`).join('\n')
            profile += `\n\n${key}:\n${indented}`
          }
        }
      }

      return new Response(profile + '\n', {
        headers: {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      })
    },
  },
  development: { hmr: true, console: true },
  port: 5173,
});

console.log("hajimihomo dev server → http://localhost:5173");
if (localRulesetsJson) console.log(`  rulesets: local ${rulesetDir}`);
else                   console.log("  rulesets: CDN proxy (set RULESET_DIR=../dist for local)");
if (await loadDevConfig()) console.log("  subscription: http://localhost:5173/sub  (.dev.yaml found)");
else                       console.log("  subscription: disabled (copy .dev.yaml.example → .dev.yaml)");

// ── File watcher for generator.js hot rebuild ─────────────────────────────────
const watchDirs = [
  resolve(root, 'profiles'),
  resolve(import.meta.dir, 'src'),
]
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRebuild(path: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const label = path.replace(root + '/', '')
    buildGenerator(label).catch(e => console.warn('⚠️  rebuild failed:', e.message))
  }, 200)
}
for (const dir of watchDirs) {
  watch(dir, { recursive: true }, (_event, filename) => {
    if (!filename) return
    if (filename.includes('node_modules/') || filename.includes('/dist/')) return
    if (/(\.ts|\.tsx|\.yaml|\.eta)$/.test(filename)) {
      scheduleRebuild(resolve(dir, filename))
    }
  })
}
