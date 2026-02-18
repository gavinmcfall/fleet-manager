import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
  ],
  build: {
    outDir: "frontend/dist",
    sourcemap: false,
    rollupOptions: {
      input: "frontend/index.html",
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["lucide-react", "react-markdown"],
        },
      },
    },
  },
  root: ".",
  publicDir: "frontend/public",
});
