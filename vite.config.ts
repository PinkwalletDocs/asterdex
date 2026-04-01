import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 项目站：pinkwalletdocs.github.io/<repo>/ */
const GH_PAGES_BASE = "/asterdex/";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? GH_PAGES_BASE : "/",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
}));
