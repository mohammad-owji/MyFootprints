import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // The only large chunk is the Firebase SDK, which is code-split behind a
    // dynamic import and only loaded when cloud sync is configured. Raise the
    // advisory limit above its size so the build stays warning-free.
    chunkSizeWarningLimit: 800,
  },
});
