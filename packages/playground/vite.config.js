import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cazala/party": fileURLToPath(new URL("../core/src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
});
