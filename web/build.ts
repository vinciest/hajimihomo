// @ts-nocheck — run with `bun run build.ts`
import { rm } from "node:fs/promises";
import { buildCatalogIndex, buildPresetsIndex } from "./data-transforms";

await rm("dist", { recursive: true, force: true });

// ── Build Tailwind CSS ────────────────────────────────────────────────────────
const tw = Bun.spawn(['./node_modules/.bin/tailwindcss', '-i', 'src/input.css', '-o', 'src/styles.css'], {
  stdout: 'inherit', stderr: 'inherit', cwd: import.meta.dir,
})
await tw.exited

// ── Generate dist/categories-index.json (runtime asset, fetched lazily) ──────
await import("./gen-data.ts");

// ── Bun plugin: transform source YAML → bundled JSON at build time ────────────
const sourceYamlPlugin = {
  name: 'source-yaml',
  setup(build: any) {
    build.onLoad({ filter: /source\/catalog\.yaml$/ }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      return { contents: JSON.stringify(buildCatalogIndex(text)), loader: 'json' }
    })
    build.onLoad({ filter: /profiles\/presets\.yaml$/ }, async ({ path }: { path: string }) => {
      const text = await Bun.file(path).text()
      return { contents: JSON.stringify(buildPresetsIndex(text)), loader: 'json' }
    })
  }
}

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  target: "browser",
  minify: true,
  plugins: [sourceYamlPlugin],
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

for (const output of result.outputs) {
  const rel = output.path.replace(process.cwd() + "/", "");
  console.log(`  ${rel}  ${(output.size / 1024).toFixed(1)} KB`);
}
console.log("  dist/categories-index.json (runtime fetch)");
