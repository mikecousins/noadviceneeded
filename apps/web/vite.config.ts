import { fileURLToPath } from "node:url";

import { reactRouter } from "@react-router/dev/vite";
import netlify from "@netlify/vite-plugin";
import netlifyReactRouter from "@netlify/vite-plugin-react-router";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // One `.env` at the repository root serves the whole workspace; React
  // Router loads it into process.env in dev.
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), reactRouter(), netlifyReactRouter(), netlify()],
});
