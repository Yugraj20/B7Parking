// Substitutes the __BASE_PATH__ placeholder in dist/404.html with the same
// base path this build used for Vite (VITE_BASE_PATH, defaulting to "/").
// Keeping this as a real build step — instead of hardcoding a repo-name
// guess inside 404.html itself — is what lets the SPA fallback work
// correctly on project pages, user/organization pages, and custom domains.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const base = process.env.VITE_BASE_PATH || "/";
const target = resolve(process.cwd(), "dist/404.html");

if (!existsSync(target)) {
  console.warn(`[postbuild] ${target} not found, skipping 404 base injection.`);
  process.exit(0);
}

const html = readFileSync(target, "utf8").replace("__BASE_PATH__", base);
writeFileSync(target, html);
console.log(`[postbuild] dist/404.html base path set to "${base}".`);
