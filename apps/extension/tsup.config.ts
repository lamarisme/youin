import { defineConfig } from "tsup"

export default defineConfig({
  entry: { content: "src/content.ts" },
  format: ["iife"],
  outDir: "dist",
  clean: true,
  target: "chrome120",
  splitting: false,
  sourcemap: false,
  minify: false,
})
