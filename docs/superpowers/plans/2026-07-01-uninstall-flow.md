# Uninstall Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single "Uninstall MyRA" action in Settings that permanently deletes all app data and removes the installed application binaries, requiring reinstallation to run MyRA again.

**Architecture:** A new main-process module (`src/main/uninstall.ts`) owns all uninstall logic — a platform capability check, then data wipe, then invoking the OS-level uninstaller (Windows NSIS uninstaller / macOS Trash). It's exposed to the renderer via one new IPC channel and consumed by a new `DangerZone` component rendered inside the existing `SettingsPanel`.

**Tech Stack:** Electron (`app`, `shell`), Node `fs`/`child_process`/`path`, better-sqlite3 (via existing `closeDb()`), React, Vitest, React Testing Library.

Full design spec: [docs/superpowers/specs/2026-07-01-uninstall-flow-design.md](../specs/2026-07-01-uninstall-flow-design.md)

## Global Constraints

- Confirmation phrase the user must type exactly is `DELETE` (case-sensitive).
- Supported platforms are `win32` and `darwin` only — any other `process.platform` value must reject with `"Uninstall is not supported on this platform."`
- In dev mode (`!app.isPackaged`) the flow must reject with `"Uninstall isn't available in development mode."` and must not touch any files.
- If the platform-specific uninstall target can't be located, reject before any deletion happens — a failed attempt is always a no-op (`"Could not find the Windows uninstaller."` / `"Could not locate the app bundle."`).
- Windows uninstaller is launched non-silently (no `/S` flag) — the user goes through the native NSIS uninstaller UI themselves.
- All app data lives under `app.getPath("userData")` — wiping it means `fs.rmSync(userDataPath, { recursive: true, force: true })` after `closeDb()`.
- Process must exit via `app.exit(0)` after triggering the platform uninstaller (matches the existing `APP_RELAUNCH` handler's use of `app.exit` over `app.quit`).

---

### Task 1: Core uninstall logic module (`src/main/uninstall.ts`)

**Files:**
- Create: `src/main/uninstall.ts`
- Create: `src/main/uninstall.test.ts`

**Interfaces:**
- Consumes: `closeDb()` from `src/main/store/db.ts` (already exists, no changes needed — `export function closeDb(): void`).
- Produces: `export async function performUninstall(): Promise<void>` — rejects with a descriptive `Error` on any capability failure, otherwise wipes data, triggers the platform uninstaller, and calls `app.exit(0)` (never resolves in practice). Also exports `findWindowsUninstaller(installDir: string): string | null` and `findMacAppBundle(execPath: string): string | null` for direct unit testing. Task 2 imports `performUninstall` from this file.

- [ ] **Step 1: Write the failing tests**

Create `src/main/uninstall.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn(() => "/fake/userData"),
    exit: vi.fn(),
  },
  shell: {
    trashItem: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("fs", () => ({
  default: {
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));
vi.mock("./store/db", () => ({
  closeDb: vi.fn(),
}));

import { app, shell } from "electron";
import fs from "fs";
import { spawn } from "child_process";
import { closeDb } from "./store/db";
import {
  performUninstall,
  findWindowsUninstaller,
  findMacAppBundle,
} from "./uninstall";

function setPlatform(platform: string) {
  Object.defineProperty(process, "platform", {
    value: platform,
    writable: true,
  });
}

function setExecPath(execPath: string) {
  Object.defineProperty(process, "execPath", {
    value: execPath,
    writable: true,
  });
}

describe("findWindowsUninstaller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the matching uninstaller path when found", () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      "MyRA.exe",
      "Uninstall MyRA.exe",
      "resources",
    ] as any);

    expect(findWindowsUninstaller("C:\\Program Files\\MyRA")).toBe(
      "C:\\Program Files\\MyRA\\Uninstall MyRA.exe",
    );
  });

  it("returns null when no uninstaller file is present", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["MyRA.exe"] as any);
    expect(findWindowsUninstaller("C:\\Program Files\\MyRA")).toBeNull();
  });

  it("returns null when the install directory can't be read", () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(findWindowsUninstaller("C:\\nonexistent")).toBeNull();
  });
});

describe("findMacAppBundle", () => {
  it("finds the .app ancestor of the executable path", () => {
    expect(
      findMacAppBundle("/Applications/MyRA.app/Contents/MacOS/MyRA"),
    ).toBe("/Applications/MyRA.app");
  });

  it("returns null when no ancestor ends in .app", () => {
    expect(findMacAppBundle("/usr/local/bin/myra")).toBeNull();
  });
});

describe("performUninstall", () => {
  const originalPlatform = process.platform;
  const originalExecPath = process.execPath;

  beforeEach(() => {
    vi.clearAllMocks();
    app.isPackaged = true;
  });

  afterEach(() => {
    setPlatform(originalPlatform);
    setExecPath(originalExecPath);
  });

  it("throws without deleting anything when not packaged", async () => {
    app.isPackaged = false;

    await expect(performUninstall()).rejects.toThrow(
      "Uninstall isn't available in development mode.",
    );
    expect(closeDb).not.toHaveBeenCalled();
    expect(fs.rmSync).not.toHaveBeenCalled();
  });

  it("throws without deleting anything on an unsupported platform", async () => {
    setPlatform("linux");

    await expect(performUninstall()).rejects.toThrow(
      "Uninstall is not supported on this platform.",
    );
    expect(closeDb).not.toHaveBeenCalled();
  });

  describe("on Windows", () => {
    beforeEach(() => {
      setPlatform("win32");
      setExecPath("C:\\Program Files\\MyRA\\MyRA.exe");
    });

    it("throws without deleting anything when the uninstaller is missing", async () => {
      vi.mocked(fs.readdirSync).mockReturnValue(["MyRA.exe"] as any);

      await expect(performUninstall()).rejects.toThrow(
        "Could not find the Windows uninstaller.",
      );
      expect(closeDb).not.toHaveBeenCalled();
      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it("wipes app data then spawns the uninstaller and exits", async () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        "MyRA.exe",
        "Uninstall MyRA.exe",
      ] as any);

      await performUninstall();

      expect(closeDb).toHaveBeenCalled();
      expect(fs.rmSync).toHaveBeenCalledWith("/fake/userData", {
        recursive: true,
        force: true,
      });
      expect(spawn).toHaveBeenCalledWith(
        "C:\\Program Files\\MyRA\\Uninstall MyRA.exe",
        [],
        { detached: true, stdio: "ignore" },
      );
      expect(app.exit).toHaveBeenCalledWith(0);
    });
  });

  describe("on macOS", () => {
    beforeEach(() => {
      setPlatform("darwin");
      setExecPath("/Applications/MyRA.app/Contents/MacOS/MyRA");
    });

    it("throws without deleting anything when the bundle path can't be resolved", async () => {
      setExecPath("/usr/local/bin/myra");

      await expect(performUninstall()).rejects.toThrow(
        "Could not locate the app bundle.",
      );
      expect(closeDb).not.toHaveBeenCalled();
    });

    it("wipes app data then trashes the app bundle and exits", async () => {
      await performUninstall();

      expect(closeDb).toHaveBeenCalled();
      expect(fs.rmSync).toHaveBeenCalledWith("/fake/userData", {
        recursive: true,
        force: true,
      });
      expect(shell.trashItem).toHaveBeenCalledWith("/Applications/MyRA.app");
      expect(app.exit).toHaveBeenCalledWith(0);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/main/uninstall.test.ts`
Expected: FAIL — `Cannot find module './uninstall'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/main/uninstall.ts`:

```ts
import { app, shell } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { closeDb } from "./store/db";

export function findWindowsUninstaller(installDir: string): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(installDir);
  } catch {
    return null;
  }
  const match = entries.find((f) => /^uninstall.*\.exe$/i.test(f));
  return match ? path.join(installDir, match) : null;
}

export function findMacAppBundle(execPath: string): string | null {
  let dir = execPath;
  while (true) {
    if (dir.toLowerCase().endsWith(".app")) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function wipeAppData(): void {
  closeDb();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
}

export async function performUninstall(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error("Uninstall isn't available in development mode.");
  }

  if (process.platform === "win32") {
    const installDir = path.dirname(process.execPath);
    const uninstallerPath = findWindowsUninstaller(installDir);
    if (!uninstallerPath) {
      throw new Error("Could not find the Windows uninstaller.");
    }
    wipeAppData();
    spawn(uninstallerPath, [], { detached: true, stdio: "ignore" });
    app.exit(0);
    return;
  }

  if (process.platform === "darwin") {
    const bundlePath = findMacAppBundle(process.execPath);
    if (!bundlePath) {
      throw new Error("Could not locate the app bundle.");
    }
    wipeAppData();
    await shell.trashItem(bundlePath);
    app.exit(0);
    return;
  }

  throw new Error("Uninstall is not supported on this platform.");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/main/uninstall.test.ts`
Expected: PASS — all `describe` blocks green (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/uninstall.ts src/main/uninstall.test.ts
git commit -m "feat: add core uninstall logic module"
```

---

### Task 2: Wire the IPC channel

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/ipc/app.ts`

**Interfaces:**
- Consumes: `performUninstall` from `src/main/uninstall.ts` (Task 1) — `export async function performUninstall(): Promise<void>`.
- Produces: `IPC.APP_UNINSTALL` channel constant; renderer function `export async function uninstallApp(): Promise<void>` in `src/renderer/ipc/app.ts`. Task 3's `DangerZone` component imports and calls `uninstallApp()`.

This is pure plumbing across three small files with no new branching logic (the logic is already tested in Task 1), so there's no new unit test here — verification is the type-check + build in Step 4.

- [ ] **Step 1: Add the IPC channel constant and payload type**

In `src/shared/ipc.ts`, add the channel next to the existing `APP_RELAUNCH` line (around line 39):

```ts
  APP_VERSION: "app:version",
  APP_RELAUNCH: "app:relaunch",
  APP_UNINSTALL: "app:uninstall",
```

Then add the payload type next to the existing `[IPC.APP_RELAUNCH]: void;` line (around line 138) in the `IpcInvokeMap` interface:

```ts
  [IPC.APP_VERSION]: void;
  [IPC.APP_RELAUNCH]: void;
  [IPC.APP_UNINSTALL]: void;
```

- [ ] **Step 2: Register the main-process handler**

In `src/main/ipc.ts`, add the import next to the other single-purpose module imports (around line 9, near `downloadUpdate`/`quitAndInstall`):

```ts
import { downloadUpdate, quitAndInstall } from "./updater";
import { performUninstall } from "./uninstall";
```

Then register the handler immediately after the existing `APP_RELAUNCH` handler (around line 255):

```ts
  ipcMain.handle(IPC.APP_RELAUNCH, () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle(IPC.APP_UNINSTALL, () => performUninstall());
```

- [ ] **Step 3: Add the renderer wrapper**

Replace the full contents of `src/renderer/ipc/app.ts`:

```ts
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function relaunchApp(): Promise<void> {
  await ipcInvoke<void>(IPC.APP_RELAUNCH);
}

export async function uninstallApp(): Promise<void> {
  await ipcInvoke<void>(IPC.APP_UNINSTALL);
}
```

- [ ] **Step 4: Verify the project still type-checks and builds**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors (confirms `IPC.APP_UNINSTALL` is wired consistently across all three files).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/renderer/ipc/app.ts
git commit -m "feat: wire app:uninstall IPC channel"
```

---

### Task 3: Danger Zone UI in Settings

**Files:**
- Create: `src/renderer/components/Settings/DangerZone.tsx`
- Create: `src/renderer/components/Settings/DangerZone.test.tsx`
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `uninstallApp()` from `src/renderer/ipc/app.ts` (Task 2); `useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean, trigger?: unknown)` from `src/renderer/hooks/useFocusTrap.ts` (already exists, no changes).
- Produces: `export function DangerZone(): JSX.Element` — no props. Rendered by `SettingsPanel`.

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/components/Settings/DangerZone.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DangerZone } from "./DangerZone";

vi.mock("../../ipc/app", () => ({
  uninstallApp: vi.fn(),
}));

import { uninstallApp } from "../../ipc/app";

describe("DangerZone", () => {
  it("keeps the Uninstall button disabled until DELETE is typed exactly", async () => {
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));

    const confirmBtn = screen.getByRole("button", { name: "Uninstall" });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "delete");
    expect(confirmBtn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "DELETE");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls uninstallApp() when confirmed", async () => {
    vi.mocked(uninstallApp).mockImplementation(() => new Promise(() => {}));
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    expect(uninstallApp).toHaveBeenCalled();
  });

  it("shows the error message inline when uninstallApp() rejects", async () => {
    vi.mocked(uninstallApp).mockRejectedValue(
      new Error("Uninstall isn't available in development mode."),
    );
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));

    await vi.waitFor(() => {
      expect(
        screen.getByText("Uninstall isn't available in development mode."),
      ).toBeTruthy();
    });
  });

  it("cancel closes the dialog and resets the typed text", async () => {
    render(<DangerZone />);
    await userEvent.click(screen.getByText("Uninstall MyRA"));
    await userEvent.type(screen.getByRole("textbox"), "DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer/components/Settings/DangerZone.test.tsx`
Expected: FAIL — `Cannot find module './DangerZone'`.

- [ ] **Step 3: Write the implementation**

Create `src/renderer/components/Settings/DangerZone.tsx`:

```tsx
import { useRef, useState } from "react";
import { uninstallApp } from "../../ipc/app";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const CONFIRM_PHRASE = "DELETE";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setConfirmText("");
    setError("");
  };

  const handleUninstall = async () => {
    setSubmitting(true);
    setError("");
    try {
      await uninstallApp();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <span className="text-xs font-semibold block mb-2 text-danger">
        Danger Zone
      </span>
      <button
        onClick={() => setOpen(true)}
        className="btn-sm w-full px-3 py-2 border border-danger-muted text-danger hoverable:hover:bg-danger-subtle"
      >
        Uninstall MyRA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="presentation"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Uninstall MyRA"
            className="bg-surface rounded-xl shadow-2xl p-4"
            style={{ width: "min(420px, 90vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold mb-2">Uninstall MyRA</h2>
            <p className="text-xs text-text-muted mb-3">
              This permanently deletes all conversations, personas, cron
              jobs, API keys, and attachments, then uninstalls MyRA.
              You&apos;ll need to reinstall it to use it again.
            </p>
            <label className="text-xs text-text-muted block mb-1">
              Type {CONFIRM_PHRASE} to confirm
            </label>
            <input
              className="w-full text-xs border rounded px-2 py-1.5 bg-surface border-border-strong focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {error && <p className="text-xs text-danger mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={close}
                disabled={submitting}
                className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
              >
                Cancel
              </button>
              <button
                onClick={handleUninstall}
                disabled={confirmText !== CONFIRM_PHRASE || submitting}
                className="btn-sm bg-danger text-on-primary disabled:opacity-50 hoverable:hover:bg-danger-dark"
              >
                {submitting ? "Uninstalling…" : "Uninstall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer/components/Settings/DangerZone.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Render DangerZone inside SettingsPanel**

In `src/renderer/components/Settings/SettingsPanel.tsx`, add the import below the existing imports (after `import { openExternal } from "../../ipc/net";`-style block, i.e. replace this exact existing line):

```ts
import {
  getProxySettings,
  setProxySettings,
  openExternal,
} from "../../ipc/net";
```

with:

```ts
import {
  getProxySettings,
  setProxySettings,
  openExternal,
} from "../../ipc/net";
import { DangerZone } from "./DangerZone";
```

Then add `<DangerZone />` between the existing "Re-run Setup Wizard" block and the version footer (replace this exact region, currently around lines 274–284):

```tsx
        <div>
          <button
            onClick={onReRunWizard}
            className="btn-sm w-full px-3 py-2 border border-border-strong hoverable:hover:bg-bubble"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <DangerZone />
        <div className="text-xs text-text-muted pt-4 border-t border-border">
          Version {version || "0.2.0"}
        </div>
```

- [ ] **Step 6: Run the full renderer test suite to check for regressions**

Run: `npx vitest run src/renderer/components/Settings`
Expected: PASS — existing `SettingsPanel.test.tsx` and `SettingsModal.test.tsx` suites still green, plus the new `DangerZone.test.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Settings/DangerZone.tsx src/renderer/components/Settings/DangerZone.test.tsx src/renderer/components/Settings/SettingsPanel.tsx
git commit -m "feat: add Danger Zone uninstall UI to Settings"
```

---

### Task 4: Manual verification

**Files:** none (verification only).

Since `npm run dev` runs unpackaged (`app.isPackaged` is `false`), clicking through the full flow in dev mode is safe — `performUninstall()` always rejects at the capability check before touching any files or spawning anything. This is the only way to see the real UI without triggering an actual uninstall.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Open Settings and trigger the flow**

In the running app: open Settings → scroll to the bottom → confirm the "Danger Zone" section renders below "Re-run Setup Wizard" with a red-accented "Uninstall MyRA" button.

- [ ] **Step 3: Verify the confirmation modal**

Click "Uninstall MyRA". Confirm the modal opens with the explanatory copy, the "Uninstall" button is disabled, typing `delete` (lowercase) keeps it disabled, and typing `DELETE` enables it.

- [ ] **Step 4: Verify the dev-mode error path**

Click "Uninstall" with `DELETE` typed. Confirm the button shows "Uninstalling…" briefly, then an inline error reading "Uninstall isn't available in development mode." appears, and the app is still running (nothing was deleted).

- [ ] **Step 5: Verify Cancel and Escape**

Reopen the modal, type partway, click "Cancel" — confirm the modal closes and the typed text is cleared on reopen. Reopen again and press Escape — confirm it closes the same way.
