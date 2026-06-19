# Task 8 Report: Main Process IPC Handlers + Electron Entry

**Status:** DONE  
**Commit:** 2f64fb6  
**Build result:** exits 0, no TypeScript errors

## What was done

- `src/preload/index.ts` — replaced stub with `contextBridge.exposeInMainWorld('ipc', { invoke, on })`. The `on` helper returns a cleanup function that calls `removeListener`.
- `src/main/ipc.ts` — replaced stub with `registerIpcHandlers(win)`. Registers all 13 IPC channels via `ipcMain.handle` using `IPC.*` constants. The `chat:send` handler streams chunks via `event.sender.send`, accumulates full content, then saves the assistant message and fires `chat:done`. The `wizard:install` handler uses the raw string `'wizard:install:line'` (one-off push channel not in the IPC contract, per brief).
- `src/main/index.ts` — replaced stub with `createWindow()` (secure `BrowserWindow`: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:false`) and `app.whenReady` that calls `initDb` then `createWindow` then `registerIpcHandlers`.

## Verification

```
vite build — main:  15.53 kB ✓
vite build — preload: 0.41 kB ✓
vite build — renderer: 214.93 kB ✓
```

All three bundles produced, exit code 0.
