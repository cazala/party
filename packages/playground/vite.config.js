import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

function normalizeBase(base) {
  if (!base) return "/";
  // Ensure leading slash.
  let b = base.startsWith("/") ? base : `/${base}`;
  // Ensure trailing slash.
  if (!b.endsWith("/")) b = `${b}/`;
  return b;
}

export default defineConfig({
  plugins: [react()],
  // Default to "/" for local dev & normal Pages hosting.
  // For subpath hosting (e.g. https://caza.la/party/), set:
  //   VITE_PUBLIC_BASE=/party/
  base: normalizeBase(process.env.VITE_PUBLIC_BASE),
  resolve: {
    alias: {
      "@cazala/party": fileURLToPath(new URL("../core/src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
});
