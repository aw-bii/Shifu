# Task 1 Report: Project Scaffold

**Status:** DONE_WITH_CONCERNS

## What Was Done

### Scaffold Approach
The `npm create electron-vite@latest` interactive CLI was skipped (would block on prompts in non-interactive PowerShell). Instead, all files were authored manually following the react-ts template structure and the brief's exact file contents.

### Files Created
| File | Purpose |
|---|---|
| `package.json` | npm manifest with all deps and `dev`, `build`, `dist`, `lint`, `test` scripts |
| `.gitignore` | Excludes node_modules, out, dist, coverage |
| `electron.vite.config.ts` | electron-vite config; renderer root set to `src/renderer/` |
| `tailwind.config.ts` | Tailwind content targeting `src/renderer/**` |
| `postcss.config.cjs` | PostCSS with tailwindcss + autoprefixer (see concern below) |
| `vitest.config.ts` | Vitest targeting `src/main/**/*.test.ts` + `src/shared/**/*.test.ts` |
| `electron-builder.config.ts` | NSIS (Win) + DMG (Mac) builder config |
| `tsconfig.json` | Project references root |
| `tsconfig.node.json` | Main + preload TypeScript config |
| `tsconfig.web.json` | Renderer TypeScript config |
| `src/renderer/index.html` | Renderer entry HTML |
| `src/renderer/main.tsx` | React root mount |
| `src/renderer/App.tsx` | "Hello BII" component |
| `src/renderer/index.css` | Tailwind directives |
| `src/renderer/ipc.ts` | Stub -- renderer IPC helpers |
| `src/main/index.ts` | BrowserWindow bootstrap; `contextIsolation: true`, `nodeIntegration: false` |
| `src/main/ipc.ts` | Stub -- main-process IPC registrations |
| `src/preload/index.ts` | contextBridge stub exposing `window.api.ping` |
| `src/shared/types.ts` | Shared types: `AgentId`, `MessageChunk`, `Message`, `Conversation` |
| `src/shared/ipc.ts` | `IPC` constant map for all channel names |

### Build Results
- `npm run build` (electron-vite build): exits 0
  - `out/main/index.js` (0.83 kB)
  - `out/preload/index.js` (0.22 kB)
  - `out/renderer/index.html` + CSS (11 kB) + JS (214 kB)
- `tsc --noEmit -p tsconfig.node.json`: exits 0
- `tsc --noEmit -p tsconfig.web.json`: exits 0
- `vitest run`: exits 1 with "No test files found" -- expected; no tests exist yet.

### Commit
- `5747f88` feat: electron-vite scaffold with Tailwind + vitest

## Concerns

### 1. `postcss.config.cjs` instead of `.ts`
The brief specifies `postcss.config.ts`. Vite's PostCSS loader requires `ts-node` to process `.ts` config files, and `ts-node` is not installed. Converting to `.cjs` (CommonJS) is the standard workaround. This has no functional impact -- PostCSS behavior is identical.

### 2. `better-sqlite3` native module not compiled
`npm install --ignore-scripts` was used because `better-sqlite3` requires native compilation (node-gyp + MSBuild) against the host Node version. Since Electron uses its own Node runtime, `better-sqlite3` must be rebuilt for Electron's ABI anyway (via `electron-rebuild` or `@electron/rebuild`). This is standard practice and will be addressed in Task 4 (SQLite store). The scaffold build is unaffected because `better-sqlite3` is only imported by main-process code not yet written.

### 3. `npm run dev` not verified interactively
Per task instructions, `npm run dev` (which opens an Electron window) was not run. `npm run build` was used instead and exits 0 cleanly.

### 4. Empty directories not committed
Empty directories (`src/main/adapters/`, `src/main/store/migrations/`, `src/main/wizard/`, `src/renderer/hooks/`, `src/renderer/components/`, `resources/`) were created locally but not committed (git ignores empty dirs). They will be populated by subsequent tasks.

---

## Code Review Findings — Fixed

### Finding 1: Raw String Literal `'ping'` in `src/preload/index.ts`

**Constraint:** IPC channel names imported from `src/shared/ipc.ts` — no raw string literals elsewhere.

**Change:**

```typescript
// Before
ping: () => ipcRenderer.invoke('ping'),

// After
import { IPC } from '../shared/ipc'
ping: () => ipcRenderer.invoke(IPC.PING),
```

**File:** `src/preload/index.ts`

- Added import: `import { IPC } from '../shared/ipc'`
- Replaced raw string `'ping'` with `IPC.PING` constant

### Finding 2: `uuid` Package Installed (not using `crypto.randomUUID()`)

**Constraint:** `crypto.randomUUID()` for all ID generation (Node 14.17+ built-in).

**Changes:**

- **File:** `package.json`
  - Removed `uuid: ^9.0.0` from `dependencies`
  - Removed `@types/uuid: ^9.0.7` from `devDependencies`
- **Command:** `npm install` (removed 2 packages; package-lock.json synced)

### Build Verification

```bash
npm run build (electron-vite build)
✓ Main: out/main/index.js (0.83 kB)
✓ Preload: out/preload/index.js (0.25 kB)
✓ Renderer: out/renderer/{index.html, assets/**} (11 kB CSS + 214 kB JS)
✓ Built in 821ms total
```

All modules transformed successfully. Build exits 0.

### Fixed Commit

- **SHA:** `19d7955`
- **Subject:** `fix: use IPC.PING constant in preload; remove uuid dep`
- **Files changed:** 3 (package.json, package-lock.json, src/preload/index.ts)
- **Insertions/Deletions:** +4 / -28
