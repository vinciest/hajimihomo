/**
 * gen-data.ts — generate dist/categories-index.json for lazy runtime loading.
 *
 * Run: bun run web/gen-data.ts
 * Called by: web/build.ts and web/dev.ts before serving.
 *
 * catalog-index and presets are now handled by the Bun source-yaml plugin
 * (transformed at bundle time directly from source YAML).
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCategoriesIndex } from "./data-transforms";

const root = resolve(import.meta.dir, "..");
const categoriesYaml = await readFile(resolve(root, "source/categories.yaml"), "utf8");
const catalogYaml    = await readFile(resolve(root, "source/catalog.yaml"),    "utf8");

const categoriesIndex = buildCategoriesIndex(categoriesYaml, catalogYaml);

const distDir = resolve(import.meta.dir, "dist");
await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, "categories-index.json"), JSON.stringify(categoriesIndex));
console.log("  dist/categories-index.json");
