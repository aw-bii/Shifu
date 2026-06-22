import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: [
      "src/main/**/*.test.ts",
      "src/shared/**/*.test.ts",
      "src/renderer/**/*.test.tsx",
      "src/renderer/**/__tests__/*.test.tsx",
    ],
    coverage: { provider: "v8" },
    globals: true,
  },
});
