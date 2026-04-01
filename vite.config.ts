import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 项目站：<user>.github.io/<repo>/ 须使用仓库子路径 */
const GH_PAGES_BASE = "/aster/";

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
