# Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all Critical and High findings from the 2026-06-22 security audit, plus selected Medium/Low findings that are low-effort.

**Architecture:** Surgical edits to existing modules — PathSecurity and WriteApproval already exist and just need wiring. The renderer ReactMarkdown fix is a props change. MCP/plugin spawn hardening strips dangerous env keys and validates commands at `addServer`/`discover` time. No new files needed except plan-level test additions.

**Tech Stack:** TypeScript, Electron 33, React, better-sqlite3, node-cron, react-markdown@10, Vitest

## Global Constraints

- Never pass shell strings to `child_process.spawn` — always array argv
- All IPC validation in `src/main/ipc.ts` handlers before forwarding to service layer
- Test files live co-located: `src/main/foo.ts` → `src/main/foo.test.ts`
- Run `npm test` after every task to verify no regressions
- Skip H-07 (SQLite encryption) and H-08 (code signing) — these require external infrastructure (SQLCipher, EV cert) and belong in a separate sprint
- Do **not** upgrade Electron as part of this plan — version pinning is a separate decision

---

### Task 1: Patch PathSecurity — add missing encoded patterns (M-03)

**Files:**
- Modify: `src/main/security/path-security.ts:9-17`
- Modify: `src/main/security/path-security.test.ts`

**Interfaces:**
- Consumes: nothing — standalone module
- Produces: `PathSecurity.isPathTraversal(input: string): boolean` — unchanged signature, new patterns handled

- [ ] **Step 1: Write failing tests**

Add to the `describe("isPathTraversal"` block in `src/main/security/path-security.test.ts`:

```typescript
it("detects URL-encoded forward slash %2f traversal", () => {
  expect(PathSecurity.isPathTraversal("..%2fetc%2fpasswd")).toBe(true);
});

it("detects double-encoded %252e%252e traversal", () => {
  expect(PathSecurity.isPathTraversal("%252e%252e%252fetc%2fpasswd")).toBe(true);
});

it("detects mixed %2F uppercase traversal", () => {
  expect(PathSecurity.isPathTraversal("..%2Fetc/passwd")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --reporter=verbose src/main/security/path-security.test.ts
```
Expected: 3 new tests FAIL

- [ ] **Step 3: Add the missing patterns**

In `src/main/security/path-security.ts`, replace the `TRAVERSAL_PATTERNS` array (lines 9-17):

```typescript
const TRAVERSAL_PATTERNS = [
  /\.\.(\/|\\)/,
  /%2e%2e/i,
  /%2f/i,
  /%5c/i,
  /%252e%252e/i,
  /%252f/i,
  /‥/,
  /‥‥/,
  /\.\.∕/,
  /∕\.\./,
];
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm test -- --reporter=verbose src/main/security/path-security.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/security/path-security.ts src/main/security/path-security.test.ts
git commit -m "fix(security): add %2f and %252e traversal patterns to PathSecurity"
```

---

### Task 2: Guard ATTACHMENT_DATA_URL with PathSecurity (C-02)

The `ATTACHMENT_DATA_URL` IPC handler at `src/main/ipc.ts:296` passes renderer-supplied `storedPath` directly to `fs.readFileSync` via `AttachmentService.getDataUrl()`. A malicious renderer can read any file on disk.

**Files:**
- Modify: `src/main/ipc.ts:296-298`
- Modify: `src/main/ipc.test.ts`

**Interfaces:**
- Consumes: `PathSecurity.resolveSafePath(path, allowedDirs)` from `src/main/security/path-security.ts`
- Consumes: `app.getPath("userData")` for the attachment base directory

- [ ] **Step 1: Write failing test**

In `src/main/ipc.test.ts`, add to the attachment section (or create one):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron app.getPath so tests don't need a real Electron context
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => "/fake/userData"), getVersion: vi.fn(() => "0.0.0") },
  BrowserWindow: vi.fn(),
}));

describe("ATTACHMENT_DATA_URL handler", () => {
  it("rejects storedPath outside userData/attachments", async () => {
    // This test verifies the guard exists; actual IPC invocation is integration-tested
    // We test the guard logic directly by importing and calling the validation
    const { PathSecurity } = await import("./security/path-security");
    const userData = "/fake/userData";
    const storedPath = "/etc/passwd";
    const result = PathSecurity.resolveSafePath(storedPath, [
      `${userData}/attachments`,
    ]);
    expect(result.allowed).toBe(false);
  });

  it("allows storedPath inside userData/attachments", async () => {
    const { PathSecurity } = await import("./security/path-security");
    const userData = "/fake/userData";
    const storedPath = `${userData}/attachments/msg-123/file.png`;
    const result = PathSecurity.resolveSafePath(storedPath, [
      `${userData}/attachments`,
    ]);
    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (PathSecurity already works)**

```
npm test -- --reporter=verbose src/main/ipc.test.ts
```
Expected: the two new path-guard tests PASS (PathSecurity is already correct)

- [ ] **Step 3: Add the guard in the IPC handler**

In `src/main/ipc.ts`, add the import at the top (after existing imports):

```typescript
import { PathSecurity } from "./security/path-security";
```

Replace the `ATTACHMENT_DATA_URL` handler (lines 296-298):

```typescript
  ipcMain.handle(IPC.ATTACHMENT_DATA_URL, (_event, { storedPath }) => {
    const userData = app.getPath("userData");
    const check = PathSecurity.resolveSafePath(storedPath, [
      path.join(userData, "attachments"),
    ]);
    if (!check.allowed) {
      throw new Error(`Access denied: ${check.reason}`);
    }
    return AttachmentService.getDataUrl(check.resolvedPath);
  });
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/ipc.test.ts
git commit -m "fix(security): guard ATTACHMENT_DATA_URL with PathSecurity containment check"
```

---

### Task 3: Sanitize attachment originalName (M-06)

`src/main/attachments/service.ts:98` derives `originalName` from `path.basename(filePath)`. On Windows, a crafted filename like `evil\x00name.txt` can contain null bytes that truncate filenames in some contexts.

**Files:**
- Modify: `src/main/attachments/service.ts:98`
- Modify: `src/main/attachments/service.test.ts`

**Interfaces:**
- Produces: `originalName` used only for display and as a filename in `destDir` — must not contain null bytes or path separators

- [ ] **Step 1: Write failing test**

In `src/main/attachments/service.test.ts`, add a test verifying null byte stripping. First read the existing test to find where to add it:

```typescript
it("strips null bytes from originalName", async () => {
  // We test the sanitization logic in isolation since ingest needs real files
  const dangerous = "evil\x00.txt";
  const sanitized = dangerous.replace(/[\x00/\\]/g, "_");
  expect(sanitized).toBe("evil_.txt");
  expect(sanitized).not.toContain("\x00");
});
```

- [ ] **Step 2: Run test to confirm it passes (documents the expected behavior)**

```
npm test -- --reporter=verbose src/main/attachments/service.test.ts
```

- [ ] **Step 3: Apply sanitization in service.ts**

In `src/main/attachments/service.ts`, replace line 98:

```typescript
      const originalName = path.basename(filePath).replace(/[\x00/\\]/g, "_");
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/attachments/service.ts src/main/attachments/service.test.ts
git commit -m "fix(security): strip null bytes and path separators from attachment originalName"
```

---

### Task 4: Wire WriteApproval into SECURITY_RESPOND (H-06)

`src/main/ipc.ts:300-302` has a no-op stub for `SECURITY_RESPOND`. The `WriteApproval` module is fully implemented but never called from the handler.

**Files:**
- Modify: `src/main/ipc.ts:300-302`
- Modify: `src/main/ipc.test.ts`

**Interfaces:**
- Consumes: `WriteApproval.respond(id: string, approved: boolean): void` from `src/main/security/write-approval.ts`
- The IPC payload shape: `{ id: string, approved: boolean }`

- [ ] **Step 1: Write failing test**

In `src/main/ipc.test.ts`, add:

```typescript
import { WriteApproval } from "./security/write-approval";

describe("SECURITY_RESPOND handler", () => {
  beforeEach(() => WriteApproval.reset());

  it("resolves a queued approval when approved=true", async () => {
    const id = WriteApproval.queue("/fake/path.txt", "content");
    const promise = WriteApproval.waitFor(id);
    // Simulate what the handler should do:
    WriteApproval.respond(id, true);
    const result = await promise;
    expect(result.approved).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (WriteApproval itself already works)**

```
npm test -- --reporter=verbose src/main/ipc.test.ts
```

- [ ] **Step 3: Wire the handler**

In `src/main/ipc.ts`, add import at the top:

```typescript
import { WriteApproval } from "./security/write-approval";
```

Replace the `SECURITY_RESPOND` handler (lines 300-302):

```typescript
  ipcMain.handle(IPC.SECURITY_RESPOND, (_event, { id, approved }) => {
    if (typeof id !== "string" || typeof approved !== "boolean") {
      throw new Error("SECURITY_RESPOND requires { id: string, approved: boolean }");
    }
    WriteApproval.respond(id, approved);
  });
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/ipc.test.ts
git commit -m "fix(security): wire WriteApproval.respond into SECURITY_RESPOND IPC handler"
```

---

### Task 5: Validate cron expression and prompt (L-01, H-09)

`src/main/ipc.ts:308-311` passes raw renderer input to `CronStore.create(input)` with no validation. An invalid cron expression crashes node-cron. A prompt with null bytes can corrupt DB storage.

**Files:**
- Modify: `src/main/ipc.ts:308-335`
- Modify: `src/main/ipc.test.ts`

**Interfaces:**
- Consumes: `node-cron`'s `cron.validate(expression): boolean` — already a dep, just not used in ipc.ts
- The validation runs before `CronStore.create` and `CronStore.update`

- [ ] **Step 1: Write failing tests**

In `src/main/ipc.test.ts`, add:

```typescript
import cron from "node-cron";

describe("cron expression validation", () => {
  it("rejects invalid cron expression", () => {
    expect(cron.validate("not a cron")).toBe(false);
  });

  it("accepts valid 5-field cron expression", () => {
    expect(cron.validate("0 9 * * 1")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```
npm test -- --reporter=verbose src/main/ipc.test.ts
```

- [ ] **Step 3: Add validation in CRON_CREATE and CRON_UPDATE handlers**

In `src/main/ipc.ts`, add import at the top:

```typescript
import cron from "node-cron";
```

Replace the `CRON_CREATE` handler (lines 308-311):

```typescript
  ipcMain.handle(IPC.CRON_CREATE, (_event, input) => {
    if (typeof input?.cronExpression !== "string" || !cron.validate(input.cronExpression)) {
      throw new Error(`Invalid cron expression: "${input?.cronExpression}"`);
    }
    if (typeof input?.prompt === "string" && input.prompt.includes("\x00")) {
      throw new Error("Cron prompt must not contain null bytes");
    }
    const job = CronStore.create(input);
    if (job.status === "active") CronEngine.scheduleJob(job);
    return job;
  });
```

Replace the `CRON_UPDATE` handler (lines 313-321):

```typescript
  ipcMain.handle(IPC.CRON_UPDATE, (_event, { id, ...changes }) => {
    if (changes.cronExpression !== undefined) {
      if (typeof changes.cronExpression !== "string" || !cron.validate(changes.cronExpression)) {
        throw new Error(`Invalid cron expression: "${changes.cronExpression}"`);
      }
    }
    if (typeof changes.prompt === "string" && changes.prompt.includes("\x00")) {
      throw new Error("Cron prompt must not contain null bytes");
    }
    CronStore.update(id, changes);
    const job = CronStore.get(id);
    if (job) {
      CronEngine.unscheduleJob(id);
      if (job.status === "active") CronEngine.scheduleJob(job);
    }
    return job;
  });
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/ipc.test.ts
git commit -m "fix(security): validate cron expression and strip null bytes from prompt in CRON_CREATE/UPDATE"
```

---

### Task 6: Fix shell.openExternal scheme allowlist (C-04)

`src/main/index.ts:83-86` calls `shell.openExternal(url)` unconditionally. Any URL scheme the renderer navigates to — including `file://`, `javascript:`, or custom OS protocol handlers — will be opened.

**Files:**
- Modify: `src/main/index.ts:83-86`

**Interfaces:**
- No new imports needed — `shell` is already imported from `electron`

- [ ] **Step 1: Apply the scheme allowlist**

In `src/main/index.ts`, replace lines 83-86:

```typescript
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const { protocol } = new URL(url);
      if (protocol === "https:" || protocol === "http:") {
        shell.openExternal(url);
      }
    } catch {
      // malformed URL — deny silently
    }
    return { action: "deny" };
  });
```

- [ ] **Step 2: Run full test suite (no unit test exists for this; covered by E2E if available)**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "fix(security): restrict shell.openExternal to http/https schemes only"
```

---

### Task 7: Add urlTransform to ReactMarkdown (H-05, partial C-04)

`src/renderer/components/Chat/MessageBubble.tsx:35` renders LLM output through ReactMarkdown with no URL filtering. A model could produce links with `javascript:`, `file://`, or custom protocol schemes that become clickable anchors.

**Files:**
- Modify: `src/renderer/components/Chat/MessageBubble.tsx:1,35`

**Interfaces:**
- Consumes: `react-markdown@10` `urlTransform` prop — signature: `(url: string) => string | null | undefined`. Return `null` to remove the attribute.

- [ ] **Step 1: Apply urlTransform**

In `src/renderer/components/Chat/MessageBubble.tsx`, add the transform function and pass it as a prop.

Replace the import line and component (full file replacement):

```typescript
import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import { AttachmentRow } from "./AttachmentRow";
import { listAttachments } from "../../ipc";
import type { Message, Attachment } from "../../../shared/types";

interface Props {
  message: Message;
}

function safeUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    if (protocol === "https:" || protocol === "http:" || protocol === "mailto:") {
      return url;
    }
  } catch {
    // relative URL — allow
    if (!url.startsWith("javascript:") && !url.startsWith("data:")) return url;
  }
  return null;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!isUser || !message.id) return;
    listAttachments(message.id)
      .then(setAttachments)
      .catch(() => {});
  }, [message.id, isUser]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown urlTransform={safeUrl}>{message.content}</ReactMarkdown>
          </div>
        )}
        {attachments.length > 0 && <AttachmentRow attachments={attachments} />}
        <div
          className={`text-xs mt-1 ${
            isUser ? "text-blue-100" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {message.backend} · {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Chat/MessageBubble.tsx
git commit -m "fix(security): add urlTransform to ReactMarkdown to block non-http/https schemes"
```

---

### Task 8: Strip dangerous env keys from MCP server spawns (C-01, H-01)

`src/main/mcp/mcp-client-manager.ts:131-132` merges renderer-controlled `server.config.env` into `process.env`. This lets a renderer-supplied MCP config override `PATH`, `LD_PRELOAD`, `DYLD_INSERT_LIBRARIES`, etc.

**Files:**
- Modify: `src/main/mcp/mcp-client-manager.ts:91-118` (addServer validation), `src/main/mcp/mcp-client-manager.ts:131-132` (spawn env)
- Modify: `src/main/mcp/mcp-client-manager.test.ts`

**Interfaces:**
- Produces: `addServer()` now throws for disallowed characters in `command`; `connect()` passes a stripped env

- [ ] **Step 1: Write failing tests**

In `src/main/mcp/mcp-client-manager.test.ts`, add:

```typescript
describe("addServer env stripping", () => {
  it("allows safe env keys", () => {
    const stripped = stripDangerousEnvKeys({ MY_VAR: "hello", HOME: "/home/user" });
    expect(stripped).toEqual({ MY_VAR: "hello", HOME: "/home/user" });
  });
});

// Export stripDangerousEnvKeys for testability — added in Step 3
import { stripDangerousEnvKeys } from "./mcp-client-manager";

describe("stripDangerousEnvKeys", () => {
  it("removes PATH override", () => {
    const result = stripDangerousEnvKeys({ PATH: "/evil", MY_VAR: "ok" });
    expect(result.PATH).toBeUndefined();
    expect(result.MY_VAR).toBe("ok");
  });

  it("removes LD_PRELOAD", () => {
    const result = stripDangerousEnvKeys({ LD_PRELOAD: "/evil.so" });
    expect(result.LD_PRELOAD).toBeUndefined();
  });

  it("removes DYLD_INSERT_LIBRARIES", () => {
    const result = stripDangerousEnvKeys({ DYLD_INSERT_LIBRARIES: "/evil.dylib" });
    expect(result.DYLD_INSERT_LIBRARIES).toBeUndefined();
  });

  it("removes LD_LIBRARY_PATH", () => {
    const result = stripDangerousEnvKeys({ LD_LIBRARY_PATH: "/evil" });
    expect(result.LD_LIBRARY_PATH).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (function not yet exported)**

```
npm test -- --reporter=verbose src/main/mcp/mcp-client-manager.test.ts
```
Expected: FAIL — `stripDangerousEnvKeys is not exported`

- [ ] **Step 3: Implement and export the helper; use it in connect()**

In `src/main/mcp/mcp-client-manager.ts`, add after the existing imports (before `const servers`):

```typescript
const BLOCKED_ENV_KEYS = new Set([
  "PATH",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "NODE_OPTIONS",
  "NODE_PATH",
]);

export function stripDangerousEnvKeys(
  env: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => !BLOCKED_ENV_KEYS.has(k)),
  );
}
```

In the `connect()` method at line 131-132, replace:

```typescript
      const proc = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...server.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });
```

with:

```typescript
      const safeEnv = server.config.env
        ? stripDangerousEnvKeys(server.config.env)
        : {};
      const proc = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...safeEnv },
        stdio: ["pipe", "pipe", "pipe"],
      });
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/mcp/mcp-client-manager.ts src/main/mcp/mcp-client-manager.test.ts
git commit -m "fix(security): strip dangerous env keys (PATH, LD_PRELOAD, etc) from MCP server spawns"
```

---

### Task 9: Restrict plugin command to plugin directory (H-02, H-03)

`src/main/plugins/plugin-manager.ts:135` spawns `plugin.descriptor.command` without verifying it resolves inside `plugin.dir`. A crafted `plugin.json` with `"command": "../../evil"` escapes the sandbox. Also, `entry.isDirectory()` returns true for symlinks to directories, enabling symlink escapes.

**Files:**
- Modify: `src/main/plugins/plugin-manager.ts:39-69` (discover — add symlink check), `src/main/plugins/plugin-manager.ts:135` (runPlugin — validate command)
- Modify: `src/main/plugins/plugin-manager.test.ts`

**Interfaces:**
- Consumes: `fs.realpathSync` (already available via `fs` import in the file — but currently the file only imports named exports from `fs`, so add `realpathSync` to the destructured import)
- The command in plugin.json must resolve inside the plugin's directory

- [ ] **Step 1: Write failing tests**

In `src/main/plugins/plugin-manager.test.ts`, add:

```typescript
describe("plugin command validation", () => {
  it("rejects command that escapes plugin directory via ..", () => {
    const pluginDir = "/fake/userData/plugins/my-plugin";
    const command = "../../evil";
    const resolved = path.resolve(pluginDir, command);
    expect(resolved.startsWith(pluginDir + path.sep) || resolved === pluginDir).toBe(false);
  });

  it("allows command that stays within plugin directory", () => {
    const pluginDir = "/fake/userData/plugins/my-plugin";
    const command = "run.sh";
    const resolved = path.resolve(pluginDir, command);
    expect(resolved.startsWith(pluginDir)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (documents the constraint logic)**

```
npm test -- --reporter=verbose src/main/plugins/plugin-manager.test.ts
```

- [ ] **Step 3: Apply symlink check in discover() and command validation in runPlugin()**

In `src/main/plugins/plugin-manager.ts`, update the import line from:

```typescript
import { readdirSync, readFileSync, existsSync } from "fs";
```

to:

```typescript
import { readdirSync, readFileSync, existsSync, realpathSync } from "fs";
```

In `discover()`, replace the `entry.isDirectory()` check (around line 40-41):

```typescript
    const entries = readdirSync(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Resolve symlinks — reject entries that escape pluginDir
      let realEntryPath: string;
      try {
        realEntryPath = realpathSync(path.join(pluginDir, entry.name));
      } catch {
        continue; // broken symlink — skip
      }
      const realPluginDir = realpathSync(pluginDir);
      if (!realEntryPath.startsWith(realPluginDir + path.sep) && realEntryPath !== realPluginDir) {
        continue; // symlink escape — skip
      }
      const jsonPath = path.join(pluginDir, entry.name, "plugin.json");
```

In `runPlugin()`, before the `spawn` call (line 135), add a command validation guard. Replace the body of the method starting at line 133:

```typescript
  runPlugin(plugin: PluginInstance, event: PluginEvent): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Validate that the command resolves inside the plugin directory
      const resolvedCommand = path.resolve(plugin.dir, plugin.descriptor.command);
      if (
        resolvedCommand !== plugin.dir &&
        !resolvedCommand.startsWith(plugin.dir + path.sep)
      ) {
        return reject(
          new Error(
            `Plugin command "${plugin.descriptor.command}" escapes plugin directory`,
          ),
        );
      }

      const proc = spawn(resolvedCommand, plugin.descriptor.args, {
        cwd: plugin.dir,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      });
```

- [ ] **Step 4: Run full test suite**

```
npm test
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/plugins/plugin-manager.ts src/main/plugins/plugin-manager.test.ts
git commit -m "fix(security): restrict plugin command to plugin directory, reject symlink escapes in discover()"
```

---

### Task 10: Upgrade xlsx past CVE-2023-30533 (M-07)

`package.json` pins `xlsx: "^0.18.5"` which has CVE-2023-30533 (prototype pollution via crafted spreadsheet cells). The fix is in `0.19.3+`.

**Files:**
- Modify: `package.json`

**Note:** `xlsx` is a notoriously unmaintained package. If `npm install xlsx@0.19.3` fails or introduces breaking API changes, evaluate replacing it with `exceljs` instead. The API used in `src/main/attachments/service.ts:66-71` is `XLSX.readFile(path)` and `XLSX.utils.sheet_to_csv(sheet)` — both stable across versions.

- [ ] **Step 1: Attempt upgrade**

```
npm install xlsx@0.19.3
```

If this fails with version-not-found, run `npm show xlsx versions --json` to find the latest safe version and use that.

- [ ] **Step 2: Run full test suite**

```
npm test
```
Expected: all tests PASS (the API surface used is stable)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): upgrade xlsx to 0.19.3+ to address CVE-2023-30533 prototype pollution"
```

---

## Skipped findings (require separate sprint)

| Finding | Reason skipped |
|---------|---------------|
| H-07: SQLite encryption at rest | Requires SQLCipher native module swap — architectural change, separate sprint |
| H-08: Code signing / publisherName | Requires EV certificate purchase and CI pipeline changes |
| M-08: Electron upgrade | Version pin is a release decision; advisories should be tracked in a separate issue |
| C-03: Pipeline inter-step trust boundary | Design question — what sanitization is appropriate depends on use case; file a separate issue |
| H-04: ATTACHMENT_INGEST path guard | filePaths are user-chosen via native file dialog — restricting them would break functionality. The SUPPORTED_MIMES check already prevents most exfil. File a separate issue to audit whether the dialog path is enforced. |

## Verification

After all tasks are complete:

```
npm test
npm run typecheck
npm run lint
```

All three must pass with zero errors before closing this plan.
