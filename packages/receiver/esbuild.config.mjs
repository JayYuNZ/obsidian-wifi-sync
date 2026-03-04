import esbuild from "esbuild";
import process from "process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const watch = process.argv.includes("--watch");
const prod = process.argv.includes("production");

const context = await esbuild.context({
  entryPoints: [path.join(__dirname, "src/main.ts")],
  bundle: true,
  external: [
    // Obsidian API — provided by the host
    "obsidian",
    "electron",
    "@codemirror/*",
    "@lezer/*",
    // Node built-ins — available via Electron, must NOT be bundled
    "http",
    "https",
    "net",
    "tls",
    "os",
    "crypto",
    "fs",
    "path",
    "stream",
    "buffer",
    "util",
    "events",
    "zlib",
    "url",
    "querystring",
  ],
  alias: {
    // Resolve workspace package to source files for bundling
    "@wifi-sync/shared": path.join(__dirname, "../shared/src"),
  },
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: path.join(__dirname, "dist/main.js"),
  platform: "node",
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
