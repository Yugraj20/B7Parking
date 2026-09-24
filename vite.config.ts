import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const envBase = process.env.VITE_BASE_PATH;
const base = envBase || (repo ? `/${repo}/` : "/");

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    target: "es2022",
    sourcemap: true
  }
});
