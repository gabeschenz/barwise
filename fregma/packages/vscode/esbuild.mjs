import * as esbuild from "esbuild";

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  minify: false,
  external: ["vscode"],
  loader: { ".json": "json" },
  // Suppress import.meta.url warnings -- esbuild bundles the JSON
  // files directly, so the createRequire calls in core are dead code
  // in the bundled output.
  logLevel: "warning",
};

const serverBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/server/OrmLanguageServer.ts"],
  outfile: "dist/server/OrmLanguageServer.js",
});

const clientBuild = esbuild.build({
  ...sharedOptions,
  entryPoints: ["src/client/extension.ts"],
  outfile: "dist/client/extension.js",
});

await Promise.all([serverBuild, clientBuild]);
console.log("Build complete.");
