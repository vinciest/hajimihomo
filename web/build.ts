// @ts-nocheck — run with `bun run build.ts`
import { rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

await rm("dist", { recursive: true, force: true });

// ── Generate categories + catalog indexes for advanced mode ────────────────────
const categoriesYaml = await readFile(resolve(import.meta.dir, "../source/categories.yaml"), "utf8");
const catalogYaml    = await readFile(resolve(import.meta.dir, "../source/catalog.yaml"),    "utf8");
const _cats   = parseYaml(categoriesYaml) as Record<string, any>;
const _catGrp = ((parseYaml(catalogYaml) as any)?.groups || {}) as Record<string, any>;

// Reverse index: category name → group IDs that include it
const _catToGroups: Record<string, string[]> = {};
for (const [gid, gdata] of Object.entries(_catGrp)) {
  for (const member of (gdata as any).members || []) {
    (_catToGroups[member] = _catToGroups[member] || []).push(gid);
  }
}

const categoriesIndex: Record<string, any> = {};
for (const [name, data] of Object.entries(_cats)) {
  if (typeof data !== "object" || data === null) continue;
  categoriesIndex[name] = {
    type:   (data as any).type   || "unknown",
    groups: _catToGroups[name]   || [],
  };
}

const catalogIndex: Record<string, any> = {};
for (const [gid, gdata] of Object.entries(_catGrp)) {
  const d = gdata as any;
  catalogIndex[gid] = {
    name:          d.name          || gid,
    description:   d.description   || "",
    defaultAction: d.default_action || "PROXY",
    tags:          d.tags          || [],
    region:        d.region        || "any",
    memberCount:   (d.members || []).length,
    members:       d.members       || [],
  };
}

const dataDir = resolve(import.meta.dir, "src/data");
await mkdir(dataDir, { recursive: true });
await writeFile(resolve(dataDir, "categories-index.json"), JSON.stringify(categoriesIndex));
await writeFile(resolve(dataDir, "catalog-index.json"),    JSON.stringify(catalogIndex));

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  target: "browser",
  minify: true,
});

if (!result.success) {
  for (const msg of result.logs) console.error(msg);
  process.exit(1);
}

// ── Generate presets from single profiles/presets.yaml ────────────────────────
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
await writeFile("dist/presets.json", JSON.stringify(presets, null, 2));

for (const output of result.outputs) {
  const rel = output.path.replace(process.cwd() + "/", "");
  console.log(`  ${rel}  ${(output.size / 1024).toFixed(1)} KB`);
}
console.log("  dist/presets.json");
console.log("  src/data/categories-index.json (bundled)");
console.log("  src/data/catalog-index.json (bundled)");
