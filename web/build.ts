// @ts-nocheck — run with `bun run build.ts`
import { rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";

await rm("dist", { recursive: true, force: true });

// ── Build Tailwind CSS ────────────────────────────────────────────────────────
const tw = Bun.spawn(['./node_modules/.bin/tailwindcss', '-i', 'src/input.css', '-o', 'src/styles.css'], {
  stdout: 'inherit', stderr: 'inherit', cwd: import.meta.dir,
})
await tw.exited

// ── Generate categories + catalog indexes (bundled into catalog.js) ────────────
await import("./gen-data.ts");

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  target: "browser",
  minify: true,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    'react':             'preact/compat',
    'react-dom':         'preact/compat',
    'react-dom/client':  'preact/compat/client',
    'react/jsx-runtime': 'preact/jsx-runtime',
  },
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
