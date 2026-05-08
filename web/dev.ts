// @ts-nocheck — run with `bun run dev.ts`
// Set RULESET_DIR env var to serve rulesets from a local build output:
//   RULESET_DIR=../dist bun run dev.ts
import index from "./index.html";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

// ── Load presets from single profiles/presets.yaml ────────────────────────────
const presetsYamlData = parseYaml(await readFile(resolve(import.meta.dir, "../profiles/presets.yaml"), "utf8")) as any;
const presetsMap = presetsYamlData?.presets || {};
const presets: Record<string, any> = {};
for (const [name, data] of Object.entries(presetsMap)) {
  const d = data as any;
  presets[name] = {
    label:       d.label       || name,
    description: d.description || "",
    target:      d.target      || "mihomo",
    topology:    d.topology    || "regional",
    features:    d.features    || {},
    groups:      d.groups      || [],
  };
}
const presetsJson = JSON.stringify(presets, null, 2);

// ── Generate category/catalog indexes for advanced mode ───────────────────────
const categoriesYaml = await readFile(resolve(import.meta.dir, "../source/categories.yaml"), "utf8");
const catalogYaml    = await readFile(resolve(import.meta.dir, "../source/catalog.yaml"),    "utf8");
const _cats   = parseYaml(categoriesYaml) as Record<string, any>;
const _catGrp = ((parseYaml(catalogYaml) as any)?.groups || {}) as Record<string, any>;
const _catToGroups: Record<string, string[]> = {};
for (const [gid, gdata] of Object.entries(_catGrp)) {
  for (const member of (gdata as any).members || []) {
    (_catToGroups[member] = _catToGroups[member] || []).push(gid);
  }
}
const categoriesIndex: Record<string, any> = {};
for (const [name, data] of Object.entries(_cats)) {
  if (typeof data !== "object" || data === null) continue;
  categoriesIndex[name] = { type: (data as any).type || "unknown", groups: _catToGroups[name] || [] };
}
const catalogIndex: Record<string, any> = {};
for (const [gid, gdata] of Object.entries(_catGrp)) {
  const d = gdata as any;
  catalogIndex[gid] = {
    name: d.name || gid, description: d.description || "",
    defaultAction: d.default_action || "PROXY", tags: d.tags || [],
    region: d.region || "any", memberCount: (d.members || []).length, members: d.members || [],
  };
}
const dataDir = resolve(import.meta.dir, "src/data");
await mkdir(dataDir, { recursive: true });
await writeFile(resolve(dataDir, "categories-index.json"), JSON.stringify(categoriesIndex));
await writeFile(resolve(dataDir, "catalog-index.json"), JSON.stringify(catalogIndex));

const distDir = process.env.RULESET_DIR
  ? resolve(import.meta.dir, process.env.RULESET_DIR)
  : null;
const rulesetDir = distDir ? resolve(distDir, "mihomo") : null;
const localRulesetsJson = distDir
  ? await readFile(resolve(distDir, "rulesets.json"), "utf8").catch(() => null)
  : null;

const CDN_RULESET = "https://cdn.jsdelivr.net/gh/cest-la-v/hajimihomo@ruleset/mihomo";

async function serveRulesetFile(pathname) {
  // Local file takes priority; fall back to CDN proxy
  if (rulesetDir) {
    const content = await readFile(resolve(rulesetDir, pathname), "utf8").catch(() => null);
    if (content) {
      const ct = pathname.endsWith(".json") ? "application/json" : "text/plain";
      return new Response(content, { headers: { "Content-Type": ct } });
    }
  }
  return fetch(`${CDN_RULESET}/${pathname}`);
}

Bun.serve({
  routes: {
    "/": index,
    "/presets.json": () => new Response(presetsJson, {
      headers: { "Content-Type": "application/json" },
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
