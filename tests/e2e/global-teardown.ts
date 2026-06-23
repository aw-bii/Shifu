import path from "path";
import fs from "fs";

const SQLITE3_BUILD = path.join(
  __dirname,
  "../../node_modules/better-sqlite3/build",
);
const RELEASE_BINARY = path.join(SQLITE3_BUILD, "Release/better_sqlite3.node");
const NODE_BINARY = path.join(SQLITE3_BUILD, "node_better_sqlite3.node");

export default async function globalTeardown() {
  const pid = process.env._E2E_ELECTRON_PID;
  if (pid) {
    try {
      process.kill(parseInt(pid, 10));
    } catch {
      // process may already be gone
    }
    // Wait for the process to release file handles before swapping the binary
    await new Promise((r) => setTimeout(r, 1500));
  }
  // Restore the Node 24 binary so `npm test` works after `npm run test:e2e`
  if (fs.existsSync(NODE_BINARY)) {
    try {
      fs.copyFileSync(NODE_BINARY, RELEASE_BINARY);
    } catch {
      // binary may still be locked — not fatal, unit tests will rebuild on next run
    }
  }
}
