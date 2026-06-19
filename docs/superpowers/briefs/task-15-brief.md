### Task 15: Packaging

**Files:**

- Modify: `electron-builder.config.ts`
- Create: `resources/` (icon placeholder)

**Interfaces:**

- Produces: distributable installer files in `dist/`

- [ ] **Step 1: Add icon placeholders**

```bash
mkdir -p resources
# Add icon.ico (Windows) and icon.icns (macOS) to resources/.
# Use any 512x512 PNG converted via online tools for testing.
```

- [ ] **Step 2: Verify build output**

```bash
npm run build
```

Expected: `out/` directory contains compiled main, preload, and renderer bundles. No TypeScript errors.

- [ ] **Step 3: Package for current platform**

```bash
npm run dist
```

Expected: `dist/` directory contains a platform-appropriate installer (`.exe` NSIS on Windows, `.dmg` on macOS). App launches from installer.

- [ ] **Step 4: Smoke test the packaged app**

- Install from the generated installer
- Verify wizard appears on first launch
- Verify conversation is created and persisted after restart

- [ ] **Step 5: Commit**

```bash
git add resources/ electron-builder.config.ts
git commit -m "chore: packaging config and icon placeholders"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Covered in task |
| --- | --- |
| Chat interface with streaming | Tasks 10, 8 |
| Claude Code bundled default | Tasks 4, 8 (bundled binary) |
| Conversation history + FTS search | Tasks 3, 11 |
| Persona management | Tasks 3, 12 |
| Setup wizard (detect, install, auth) | Tasks 7, 13 |
| Backend switcher per-conversation | Tasks 6, 12 |
| Gemini CLI adapter | Task 5 |
| Opencode adapter | Task 5 |
| IPC types in src/shared/ipc.ts | Task 2 |
| contextIsolation + no nodeIntegration | Task 8 |
| argv arrays, no shell strings | Tasks 4, 5, 7 |
| SQLite migrations | Task 3 |
| Persona locked at conversation creation | Task 8 (ipc.ts handler) |
| electron-vite build | Task 1 |
| electron-builder packaging | Task 15 |

### Notes

- Task 8 (`ipc.ts`) calls `installBackend` but the `wizard:install:line` push channel is not declared in `IPC` — it is used directly as `'wizard:install:line'`. This is intentional (it's a sub-channel of the install flow, not a top-level IPC concern), but document it in `src/shared/ipc.ts` as a comment.
- `AdapterManager.listAvailable()` calls `isAvailable()` twice per adapter (once for `available`, once for `authenticated`). In Task 6, replace this with a single call: `const avail = await a.isAvailable(); return { ..., available: avail, authenticated: avail }`.
