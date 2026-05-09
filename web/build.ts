// @ts-nocheck — run with `bun run build.ts`
import { rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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

// ── Write dist/presets.json from generated src/data/presets.json ─────────────
const presetsJson = await readFile(resolve(import.meta.dir, "src/data/presets.json"), "utf8");
await writeFile("dist/presets.json", presetsJson);

for (const output of result.outputs) {
  const rel = output.path.replace(process.cwd() + "/", "");
  console.log(`  ${rel}  ${(output.size / 1024).toFixed(1)} KB`);
}
console.log("  dist/presets.json");
console.log("  src/data/categories-index.json (bundled)");
console.log("  src/data/catalog-index.json (bundled)");
