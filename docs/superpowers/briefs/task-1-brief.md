# Task 1 Brief: Project Scaffold

## Global Constraints

- `contextIsolation: true`, `nodeIntegration: false` on every BrowserWindow — no exceptions.
- All `child_process.spawn` calls use argv arrays, never shell strings.
- IPC channel names imported from `src/shared/ipc.ts` — no raw string literals elsewhere.
- `BackendAdapter.send()` must return `AsyncIterable<MessageChunk>` and respect `abort()`.
- Persona text injected as a CLI flag inside adapters — never concatenated into user message.
- SQLite migrations in `src/main/store/migrations/` numbered `001_`, `002_`, applied in order.
- `crypto.randomUUID()` for all ID generation (Node 14.17+ built-in).

## Planned File Structure

```
src/
  shared/
    types.ts
    ipc.ts
  main/
    index.ts
    ipc.ts
    adapters/
    store/
    wizard/
  renderer/
    index.html
    main.tsx
    App.tsx
    ipc.ts
    hooks/
    components/
  preload/
    index.ts
electron.vite.config.ts
tailwind.config.ts
electron-builder.config.ts
vitest.config.ts
```

## Task 1: Project Scaffold

**Files:**

- Create: `electron.vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.ts`
- Create: `vitest.config.ts`
- Create: `electron-builder.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/index.css`
- Create: `src/main/index.ts` (stub)
- Create: `src/preload/index.ts` (stub)

**Interfaces:**

- Produces: runnable `npm run dev` that opens an Electron window with "Hello BII" in the renderer.

- [ ] **Step 1: Scaffold with electron-vite**

```bash
npm create electron-vite@latest . -- --template react-ts
```

When prompted about existing files, accept overwrite only for `package.json`, `.gitignore`. Do **not** overwrite `CLAUDE.md`, `AGENTS.md`, `PRD.md`, `TRD.md`, `docs/`, `MEMORY.md`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install better-sqlite3 uuid
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D @types/better-sqlite3 @types/uuid vitest @vitest/coverage-v8 tailwindcss postcss autoprefixer electron-builder
```

- [ ] **Step 4: Init Tailwind**

```bash
npx tailwindcss init -p
```

- [ ] **Step 5: Write `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 6: Add Tailwind directives to `src/renderer/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
    coverage: { provider: 'v8' },
  },
})
```

- [ ] **Step 8: Write `electron-builder.config.ts`**

```typescript
import type { Configuration } from 'electron-builder'

export default {
  appId: 'com.bii.agent-harness',
  productName: 'BII Agent Harness',
  directories: { output: 'dist' },
  files: ['out/**/*'],
  win: { target: 'nsis', icon: 'resources/icon.ico' },
  mac: { target: 'dmg', icon: 'resources/icon.icns', category: 'public.app-category.productivity' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
} satisfies Configuration
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: Electron window opens. No TypeScript errors in terminal.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: electron-vite scaffold with Tailwind + vitest"
```
