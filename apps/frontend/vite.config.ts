import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    // @repo/shared is a linked workspace package compiled to CommonJS, and Vite
    // does not pre-bundle linked dependencies by default. Served raw, its
    // `__exportStar` re-exports are invisible to the browser and every named
    // import fails ("does not provide an export named 'RULE_CATALOG'").
    // Pre-bundling it with esbuild gives real ESM named exports.
    include: ["@repo/shared"],
  },
});
