import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// Copy SQL migration files to out/main/migrations at build time so the
// bundled app can read them at runtime via fs.readdirSync(__dirname + "/migrations").
function copyMigrationsPlugin() {
  return {
    name: "copy-migrations",
    closeBundle() {
      const src = path.resolve(__dirname, "src/main/store/migrations");
      const dest = path.resolve(__dirname, "out/main/migrations");
      fs.mkdirSync(dest, { recursive: true });
      for (const f of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, f), path.join(dest, f));
      }
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
      },
    },
    plugins: [react()],
  },
});
