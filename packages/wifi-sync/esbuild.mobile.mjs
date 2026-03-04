import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sender-only build — no node-forge, no server code, safe for Android/iOS
const context = await esbuild.context({
  entryPoints: [path.join(__dirname, "src/main.mobile.ts")],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  alias: {
    "@wifi-sync/shared": path.join(__dirname, "../../packages/shared/src"),
  },
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: false,
  treeShaking: true,
  outfile: path.join(__dirname, "dist/main.js"),
  platform: "browser",
});

await context.rebuild();
await context.dispose();
