# researcher Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three remaining gaps: create the `aw-bii/researcher` GitHub repo and fix publisher config, add a `TestAdapter` and real Playwright E2E tests covering wizard/chat/persona/history flows, and restore the `install.ts` unit test.

**Architecture:** Task 1 is pure config/git — no source changes. Task 2 adds one new source file (`test.adapter.ts`), two small edits to existing source files (`manager.ts`, `index.ts`), and three new test infrastructure files. Task 3 restores a single deleted test file. All three tasks are independent and can be done in any order.

**Tech Stack:** `gh` CLI, `@playwright/test`, `playwright` (bundled with `@playwright/test`), Electron, Vitest, TypeScript

## Global Constraints

- Repo name on GitHub: `researcher` (capital S), owner: `aw-bii`
- `electron-builder.config.ts` `owner`/`repo` values must match exactly
- `E2E_TEST=1` env var must be the sole gate for test-only behaviour — no other mechanism
- E2E tests run against compiled output (`out/main/index.js`) — always run `npm run build` before `npm run test:e2e`
- Playwright workers must be set to 1 (worker-scoped Electron app fixture requires single worker)
- `install.test.ts` must assert `spawn` is called without `shell: true`

---

## File Map

```
Create:
  src/main/adapters/test.adapter.ts         — TestAdapter (echoes input, used when E2E_TEST=1)
  tests/e2e/fixtures.ts                      — worker-scoped Electron app + window fixtures
  tests/e2e/app.spec.ts                      — 4 E2E flows: wizard, chat, persona, history
  src/main/wizard/install.test.ts            — restored unit tests for installBackend

Modify:
  electron-builder.config.ts                 — fix owner/repo placeholders
  .github/workflows/ci.yml                   — add master to trigger branches
  src/main/adapters/manager.ts               — register TestAdapter when E2E_TEST=1
  src/main/index.ts                          — set isolated userData path when E2E_TEST=1
  tests/e2e/electron.config.ts               — replace stub with real Playwright config
  package.json                               — add @playwright/test devDep

Delete:
  tests/e2e/basic.spec.ts                    — build-artifact checks replaced by app.spec.ts
```

---

### Task 1: GitHub Repo + Publisher Config

**Files:**
- Modify: `electron-builder.config.ts`
- Modify: `.github/workflows/ci.yml`
- Shell: `gh repo create`, `git remote add`, `git push`

**Interfaces:**
- Produces: live GitHub repo at `https://github.com/aw-bii/researcher` with all commits; CI workflow triggers on `master`

- [ ] **Step 1: Create the GitHub repo**

Run:
```bash
gh repo create aw-bii/researcher --public --description "BII Agent Harness — desktop AI chat app"
```
Expected: `✓ Created repository aw-bii/researcher on GitHub`

- [ ] **Step 2: Add remote and push**

Run:
```bash
git remote add origin https://github.com/aw-bii/researcher.git
git push -u origin master
```
Expected: branch `master` pushed, tracking set.

- [ ] **Step 3: Fix electron-builder owner and repo**

In `electron-builder.config.ts`, change:
```ts
  publish: {
    provider: "github",
    owner: "bii",
    repo: "agent-harness",
    releaseType: "release",
  },
```
to:
```ts
  publish: {
    provider: "github",
    owner: "aw-bii",
    repo: "researcher",
    releaseType: "release",
  },
```

- [ ] **Step 4: Update CI workflow to trigger on master**

In `.github/workflows/ci.yml`, change:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```
to:
```yaml
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
```

- [ ] **Step 5: Commit and push**

```bash
git add electron-builder.config.ts .github/workflows/ci.yml
git commit -m "fix: point publisher config at aw-bii/researcher, add master to CI triggers"
git push
```
Expected: push succeeds; visit `https://github.com/aw-bii/researcher/actions` and verify CI workflow appears (may be queued or running).

---

### Task 2: TestAdapter + Playwright E2E Tests

**Files:**
- Create: `src/main/adapters/test.adapter.ts`
- Modify: `src/main/adapters/manager.ts`
- Modify: `src/main/index.ts`
- Modify: `package.json`
- Modify: `tests/e2e/electron.config.ts`
- Create: `tests/e2e/fixtures.ts`
- Delete: `tests/e2e/basic.spec.ts`
- Create: `tests/e2e/app.spec.ts`

**Interfaces:**
- Consumes: `BackendAdapter`, `MessageChunk`, `Attachment` from `src/shared/types.ts`
- Produces:
  - `TestAdapter` — implements `BackendAdapter`, exported from `test.adapter.ts`
  - `test` fixture — extended `@playwright/test` `test` with worker-scoped `app: ElectronApplication` and `window: Page`, exported from `tests/e2e/fixtures.ts`

- [ ] **Step 1: Install @playwright/test**

Run:
```bash
npm install --save-dev @playwright/test
```
Expected: `@playwright/test` added to `devDependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Create TestAdapter**

Create `src/main/adapters/test.adapter.ts`:
```ts
import type { BackendAdapter, MessageChunk, Attachment } from "../../shared/types";

export class TestAdapter implements BackendAdapter {
  id = "test";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkAuth(): Promise<boolean> {
    return true;
  }

  async *send(
    message: string,
    _persona?: string,
    _attachments?: Attachment[],
  ): AsyncIterable<MessageChunk> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield { type: "text", content: `Echo: ${message}` };
    yield { type: "done", content: "" };
  }

  abort(): void {
    // no-op — synchronous echo has nothing to cancel
  }
}
```

- [ ] **Step 3: Wire TestAdapter into AdapterManager**

In `src/main/adapters/manager.ts`, add the import and the conditional registration:
```ts
import { ClaudeAdapter } from "./claude.adapter";
import { GeminiAdapter } from "./gemini.adapter";
import { OpencodeAdapter } from "./opencode.adapter";
import { TestAdapter } from "./test.adapter";
import type { BackendAdapter, BackendInfo } from "../../shared/types";

const registry: BackendAdapter[] = [
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new OpencodeAdapter(),
];

if (process.env.E2E_TEST === "1") {
  registry.push(new TestAdapter());
}

let activeId = "claude";
// ... rest of file unchanged
```

- [ ] **Step 4: Run existing unit tests to verify nothing broke**

Run:
```bash
npm test
```
Expected: all tests pass (same count as before — no new tests yet).

- [ ] **Step 5: Add E2E isolated userData path to main/index.ts**

At the top of `src/main/index.ts`, add an `import os from "os"` and insert the `setPath` call before `app.whenReady()`. The full file after edits:

```ts
import { app, BrowserWindow, shell } from "electron";
import path from "path";
import os from "os";
import { initDb, getDb } from "./store/db";
import { registerIpcHandlers } from "./ipc";
import { initUpdater } from "./updater";

// Must run before app.whenReady() — redirects SQLite to a temp dir so each
// E2E test run starts with a clean database
if (process.env.E2E_TEST === "1") {
  app.setPath("userData", path.join(os.tmpdir(), "bii-e2e-test"));
}

function loadWindowState(): { ... } { ... }   // unchanged
// ... rest of file unchanged
```

Only add the `import os` line and the `if (process.env.E2E_TEST === "1") { ... }` block. Do not change anything else.

- [ ] **Step 6: Build the app**

Run:
```bash
npm run build
```
Expected: TypeScript compiles cleanly, `out/main/index.js` and `out/renderer/index.html` exist.

- [ ] **Step 7: Replace the Playwright config stub**

Overwrite `tests/e2e/electron.config.ts` with:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  workers: 1,
});
```

- [ ] **Step 8: Create the fixtures file**

Create `tests/e2e/fixtures.ts`:
```ts
import { test as base } from "@playwright/test";
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import path from "path";

type WorkerFixtures = {
  app: ElectronApplication;
  window: Page;
};

export const test = base.extend<{}, WorkerFixtures>({
  app: [
    async ({}, use) => {
      const electronApp = await electron.launch({
        args: [path.join(process.cwd(), "out/main/index.js")],
        env: { ...process.env, E2E_TEST: "1" },
      });
      await use(electronApp);
      await electronApp.close();
    },
    { scope: "worker" },
  ],

  window: [
    async ({ app }, use) => {
      const win = await app.firstWindow();
      await win.waitForLoadState("domcontentloaded");
      await use(win);
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
```

- [ ] **Step 9: Delete the placeholder spec and create app.spec.ts**

Delete `tests/e2e/basic.spec.ts`.

Create `tests/e2e/app.spec.ts`:
```ts
import { test, expect } from "./fixtures";

// Tests run sequentially in a single worker sharing one Electron instance.
// Each test builds on the state left by the previous one — this is intentional
// for a "full flow" E2E that mirrors real user behaviour.

test("wizard flow — complete all 3 steps", async ({ window }) => {
  // Step 1: wizard is visible and backend detection runs
  await expect(window.getByText("Detecting AI backends")).toBeVisible({
    timeout: 10_000,
  });

  // Wait for probe to finish (Next button becomes enabled)
  const nextBtn = window.getByRole("button", { name: "Next" });
  await expect(nextBtn).toBeEnabled({ timeout: 10_000 });
  await nextBtn.click();

  // Step 2: optional installs — click Continue to skip
  const continueBtn = window.getByRole("button", { name: /next|continue/i });
  await expect(continueBtn).toBeVisible({ timeout: 5_000 });
  await continueBtn.click();

  // Step 3: auth check — all available backends authenticated
  await expect(
    window.getByText("All available backends are authenticated"),
  ).toBeVisible({ timeout: 5_000 });

  await window.getByRole("button", { name: "Finish Setup" }).click();

  // Main app loaded — sidebar header visible
  await expect(window.getByText("BII Agent Harness")).toBeVisible({
    timeout: 5_000,
  });
});

test("chat flow — send a message and receive echo", async ({ window }) => {
  // Select the test backend from the BackendSwitcher
  const switcher = window.locator("select").first();
  await switcher.selectOption("test");

  // Type a message and send
  const input = window.getByPlaceholder("Message...");
  await input.fill("hello e2e");
  await input.press("Control+Enter");

  // User bubble appears
  await expect(window.getByText("hello e2e")).toBeVisible({ timeout: 5_000 });

  // Echo response appears
  await expect(window.getByText("Echo: hello e2e")).toBeVisible({
    timeout: 10_000,
  });
});

test("persona flow — create a persona and assign it", async ({ window }) => {
  // Open persona panel
  await window.getByRole("button", { name: "Personas" }).click();
  await expect(window.getByText("Personas")).toBeVisible({ timeout: 3_000 });

  // Open new persona form
  await window.getByRole("button", { name: "+ New" }).click();

  // Fill in name and system prompt
  await window.getByPlaceholder("Name").fill("E2E Persona");
  await window.getByPlaceholder("System prompt...").fill("You are a test assistant.");

  // Save
  await window.getByRole("button", { name: "Save" }).click();

  // Persona appears in the list
  await expect(window.getByText("E2E Persona")).toBeVisible({ timeout: 3_000 });

  // Select the persona
  await window.getByText("E2E Persona").click();

  // Send a message with persona active
  const input = window.getByPlaceholder("Message...");
  await input.fill("persona test");
  await input.press("Control+Enter");

  await expect(window.getByText("Echo: persona test")).toBeVisible({
    timeout: 10_000,
  });
});

test("history flow — conversations from earlier tests appear in sidebar", async ({
  window,
}) => {
  // The sidebar should list conversations created in the chat and persona tests
  // (same Electron session — DB persists across tests in this worker)
  const sidebar = window.locator(".w-64");
  const convItems = sidebar.locator("button").filter({ hasText: /hello e2e|persona test/i });
  await expect(convItems.first()).toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 10: Run E2E tests**

Run:
```bash
npm run test:e2e
```
Expected: 4 tests pass. If any fail, check that `npm run build` ran first and that `out/main/index.js` exists.

- [ ] **Step 11: Commit**

```bash
git add src/main/adapters/test.adapter.ts src/main/adapters/manager.ts src/main/index.ts package.json package-lock.json tests/e2e/electron.config.ts tests/e2e/fixtures.ts tests/e2e/app.spec.ts
git rm tests/e2e/basic.spec.ts
git commit -m "feat: add TestAdapter and Playwright E2E tests (wizard, chat, persona, history)"
git push
```

---

### Task 3: Restore install.ts Unit Test

**Files:**
- Create: `src/main/wizard/install.test.ts`

**Interfaces:**
- Consumes: `installBackend(id: string, onData: (line: string) => void): Promise<{ success: boolean; error?: string }>` from `src/main/wizard/install.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/main/wizard/install.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// child_process mock — must be defined before importing the module under test
vi.mock("child_process", () => {
  const mockSpawn = vi.fn();
  return { spawn: mockSpawn };
});

import { installBackend } from "./install";
import { spawn } from "child_process";

function makeMockProcess(exitCode: number, stderrOutput = "") {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation((_event: string, _cb: Function) => {});

  mockProc.stderr.on.mockImplementation((_event: string, cb: Function) => {
    if (stderrOutput) {
      // emit stderr data synchronously so it is captured before close fires
      cb(Buffer.from(stderrOutput));
    }
  });

  mockProc.on.mockImplementation((event: string, cb: Function) => {
    if (event === "close") setTimeout(() => cb(exitCode), 0);
    if (event === "error") { /* never fires in these tests */ }
  });

  return mockProc;
}

describe("installBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves { success: true } when gemini install exits 0", async () => {
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockProcess(0),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(
      "npm",
      ["install", "-g", "@google/gemini-cli"],
      expect.objectContaining({ stdio: "pipe" }),
    );
    // Regression guard: shell:true must not be present
    expect(spawn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  });

  it("resolves { success: false } for an unknown backend without calling spawn", async () => {
    const result = await installBackend("unknown", vi.fn());

    expect(result).toEqual({
      success: false,
      error: "Unknown backend: unknown",
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("returns permission-error message when stderr contains EACCES", async () => {
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockProcess(1, "npm ERR! EACCES: permission denied"),
    );

    const result = await installBackend("opencode", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/i);
  });

  it("returns generic error message for non-permission failure", async () => {
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(
      makeMockProcess(1, "some unrelated error"),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Install failed with exit code 1/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/main/wizard/install.test.ts
```
Expected: FAIL — `installBackend` is imported fine but the mock needs to match the real signature. If the file is missing the mock will throw `Cannot find module`.

- [ ] **Step 3: Run all tests to verify the restored file passes**

Run:
```bash
npm test
```
Expected: all tests pass including the 4 new install tests. Total count increases by 4.

- [ ] **Step 4: Commit**

```bash
git add src/main/wizard/install.test.ts
git commit -m "test: restore install.ts unit tests with shell:true regression guard"
git push
```

---

## Self-Review

**1. Spec coverage:**
| Spec requirement | Task | Status |
|---|---|---|
| Create `aw-bii/researcher` public repo | Task 1 Step 1–2 | ✓ |
| Fix `electron-builder.config.ts` owner/repo | Task 1 Step 3 | ✓ |
| Update CI triggers for master | Task 1 Step 4 | ✓ |
| `TestAdapter` echoes input with 50ms delay | Task 2 Step 2 | ✓ |
| Register TestAdapter when `E2E_TEST=1` | Task 2 Step 3 | ✓ |
| Isolated userData dir for E2E | Task 2 Step 5 | ✓ |
| Replace electron.config.ts stub | Task 2 Step 7 | ✓ |
| Worker-scoped app + window fixtures | Task 2 Step 8 | ✓ |
| Wizard flow test | Task 2 Step 9 | ✓ |
| Chat flow test | Task 2 Step 9 | ✓ |
| Persona flow test | Task 2 Step 9 | ✓ |
| History flow test | Task 2 Step 9 | ✓ |
| Delete basic.spec.ts | Task 2 Step 9 | ✓ |
| install.ts: success case | Task 3 | ✓ |
| install.ts: unknown backend | Task 3 | ✓ |
| install.ts: permission error | Task 3 | ✓ |
| install.ts: generic error | Task 3 | ✓ |
| install.ts: shell:true regression guard | Task 3 | ✓ |

**2. Placeholder scan:** No TBDs, TODOs, or incomplete steps found.

**3. Type consistency:**
- `TestAdapter.send` signature matches `BackendAdapter` interface: `send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk>` ✓
- `installBackend` return type used in test assertions: `{ success: boolean; error?: string }` matches `install.ts` ✓
- `WorkerFixtures` type in fixtures.ts matches actual usage in app.spec.ts ✓
