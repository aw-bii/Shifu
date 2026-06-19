import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  workers: 1,
  globalSetup: path.join(__dirname, "global-setup.ts"),
  globalTeardown: path.join(__dirname, "global-teardown.ts"),
});
