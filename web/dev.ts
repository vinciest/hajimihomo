// @ts-nocheck — run with `bun run dev.ts`
// Set RULESET_DIR env var to serve rulesets from a local build output:
//   RULESET_DIR=../dist bun run dev.ts
import { plugin } from 'bun'
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCatalogIndex, buildPresetsIndex, buildCategoriesIndex } from "./data-transforms";

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
// (The onResolve plugin handles server-side bundling; this covers browser dynamic imports)
const genResult = await Bun.build({
  entrypoints: [resolve(import.meta.dir, 'src/generator-exports.ts')],
  target: 'browser',
  format: 'esm',
})
if (genResult.success) {
  await writeFile(resolve(distDir, 'generator.js'), await genResult.outputs[0].arrayBuffer())
} else {
  console.warn('⚠️  generator.js build failed:', genResult.logs)
}

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
    // Always intercept /ruleset/mihomo/* — local file or CDN proxy
    "/ruleset/mihomo/rulesets.json": () =>
      localRulesetsJson
        ? new Response(localRulesetsJson, { headers: { "Content-Type": "application/json" } })
        : fetch(`${CDN_RULESET}/rulesets.json`),
    "/ruleset/mihomo/*": (req) => {
      const pathname = new URL(req.url).pathname.replace("/ruleset/mihomo/", "");
      return serveRulesetFile(pathname);
    },
  },
  development: { hmr: true, console: true },
  port: 5173,
});

console.log("hajimihomo dev server → http://localhost:5173");
if (localRulesetsJson) console.log(`  rulesets: local ${rulesetDir}`);
else                   console.log("  rulesets: CDN proxy (set RULESET_DIR=../dist for local)");
