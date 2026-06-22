# researcher Completion — Design Spec

**Date:** 2026-06-19
**Status:** Approved

---

## Overview

Three pending gaps remain before the BII Agent Harness project is fully ship-ready:

1. **GitHub repo + publisher config** — Create `aw-bii/researcher`, push the codebase, and fix the placeholder `owner`/`repo` values in `electron-builder.config.ts`.
2. **E2E tests (full flow)** — Replace the placeholder Playwright tests with real Electron E2E coverage: wizard, chat, persona, and conversation history flows. A `TestAdapter` echoes input so tests run without a real CLI in CI.
3. **`install.ts` unit test** — Restore `src/main/wizard/install.test.ts` (deleted during security hardening) with four cases covering success, unknown backend, permission errors, and generic failures.

---

## Task 1: GitHub Repo + Publisher Config

### Actions

- Create `aw-bii/researcher` as a public GitHub repo via `gh repo create`.
- Push the existing `master` branch.
- In `electron-builder.config.ts`, change:
  ```ts
  owner: "bii",
  repo: "agent-harness",
  ```
  to:
  ```ts
  owner: "aw-bii",
  repo: "researcher",
  ```
- In `.github/workflows/ci.yml`, update the `on.push.branches` and `on.pull_request.branches` triggers to include `master` (current branch) alongside `main`.

### No other changes required

The `release.yml` workflow uses `GITHUB_TOKEN` from `secrets` — no hardcoded values. The `softprops/action-gh-release` step uses `github.ref_name` for the tag, which is correct.

---

## Task 2: TestAdapter + Playwright E2E

### TestAdapter

**File:** `src/main/adapters/test.adapter.ts`

```ts
// Echoes the user message back with a 50ms delay — used only when E2E_TEST=1
```

- `id = "test"`
- `isAvailable()` → `Promise.resolve(true)`
- `checkAuth()` → `Promise.resolve(true)`
- `send(message)` → yields `{ type: "text", content: "Echo: <message>" }` after 50ms, then `{ type: "done", content: "" }`
- `abort()` → no-op

**AdapterManager wiring** (`src/main/adapters/manager.ts`):

After the registry is built, conditionally append the `TestAdapter`:

```ts
if (process.env.E2E_TEST === "1") {
  registry.push(new TestAdapter())
}
```

This has zero effect on production builds. The env var is only set by Playwright at launch time.

### Playwright Config

**File:** `tests/e2e/electron.config.ts` (replace the stub)

- Uses `@playwright/test` with the `electron` project type.
- Points `testDir` at `tests/e2e/`.
- 30s timeout per test.

**File:** `tests/e2e/fixtures.ts`

Exports an `app` fixture:
- `beforeAll`: calls `electron.launch({ args: ["out/main/index.js"], env: { ...process.env, E2E_TEST: "1" } })`
- `afterAll`: calls `app.close()`
- Exposes `window` (the first `BrowserWindow` page) to each test

Requires a prior `npm run build` — tests run against compiled output, not dev server.

### Test Flows

**File:** `tests/e2e/app.spec.ts` (replaces `basic.spec.ts`)

| Flow | Steps | Pass criteria |
|------|-------|---------------|
| **Wizard** | App launches | Wizard container visible |
| | Click through Step 1 → Step 2 → Step 3 → Finish | Main chat UI visible, sidebar visible |
| **Chat** | Select `test` backend from BackendSwitcher | BackendSwitcher shows "Test" |
| | Type "hello world" in InputBar, press Ctrl+Enter | Message bubble "hello world" visible |
| | Wait for response | Bubble containing "Echo: hello world" visible |
| **Persona** | Open Persona panel | Panel visible |
| | Fill name "E2E Persona", system prompt "You are a test", save | Persona appears in list |
| | Select persona | Persona highlighted as active |
| | Send another message | New conversation created with persona |
| **History** | Re-launch app (close + reopen) | Previous conversation titles appear in sidebar |

`basic.spec.ts` is deleted — build artifact existence is validated by `npm run build` in CI, not a Playwright test.

### package.json additions

```json
"test:e2e": "playwright test --config tests/e2e/electron.config.ts"
```

`@playwright/test` must be installed: `npm install --save-dev @playwright/test`. Playwright browsers also need to be downloaded once: `npx playwright install chromium`.

---

## Task 3: install.ts Unit Test

**File:** `src/main/wizard/install.test.ts` (restore)

Four test cases, all using a `child_process` mock:

| Case | Mock behaviour | Expected return |
|------|---------------|-----------------|
| Gemini install succeeds | `spawn` exits 0 | `{ success: true }` |
| Unknown backend | — (no spawn called) | `{ success: false, error: "Unknown backend: unknown" }` |
| Exit 1 + permission error in stderr | exits 1, stderr contains "EACCES" | `{ success: false, error: /Permission denied/ }` |
| Exit 1 + generic error | exits 1, stderr is "some error" | `{ success: false, error: /Install failed with exit code 1/ }` |

Regression guard: assert `spawn` is called without `{ shell: true }` (verifies the security fix holds).

---

## Out of Scope

- Changing the app name/branding from "BII Agent Harness" to "researcher" — the repo is named researcher but the app identity is unchanged.
- Additional E2E flows (pipeline mode, attachments) — deferred; the four flows above cover the core value prop.
- macOS `.icns` generation in CI — electron-builder handles this on macOS runners; no code change needed.
