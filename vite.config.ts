import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  resolve: {
    // Prefer TypeScript sources over any stray compiled .js siblings.
    extensions: [".mts", ".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"]
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html")
      }
    }
  }
});
