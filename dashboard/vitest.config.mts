import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets tests use the same "@/..." imports as the app (see "paths" in tsconfig.json).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
