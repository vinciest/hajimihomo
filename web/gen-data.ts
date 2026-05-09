/**
 * gen-data.ts — generate web/src/data/*.json from source/ YAML.
 *
 * Run: bun run web/gen-data.ts
 * Called by: web/build.ts (web app build) and make generator (standalone CLI bundle).
 *
 * Output files are gitignored build artifacts — do not commit them.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

const root = resolve(import.meta.dir, "..");

const categoriesYaml = await readFile(resolve(root, "source/categories.yaml"), "utf8");
const catalogYaml    = await readFile(resolve(root, "source/catalog.yaml"),    "utf8");
const presetsYaml    = await readFile(resolve(root, "profiles/presets.yaml"),   "utf8");
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

const presetsMap = ((parseYaml(presetsYaml) as any)?.presets || {}) as Record<string, any>;
const presetsIndex: Record<string, any> = {};
for (const [name, data] of Object.entries(presetsMap)) {
  const d = data as any;
  presetsIndex[name] = {
    label:       d.label       || name,
    description: d.description || "",
    target:      d.target      || "mihomo",
    topology:    d.topology    || "regional",
    features:    d.features    || {},
    groups:      d.groups      || [],
  };
}

const dataDir = resolve(import.meta.dir, "src/data");
await mkdir(dataDir, { recursive: true });
await writeFile(resolve(dataDir, "categories-index.json"), JSON.stringify(categoriesIndex));
await writeFile(resolve(dataDir, "catalog-index.json"),    JSON.stringify(catalogIndex));
await writeFile(resolve(dataDir, "presets.json"),          JSON.stringify(presetsIndex));
