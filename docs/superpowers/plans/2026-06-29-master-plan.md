# Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Source plans merged:**
- `2026-06-29-ipc-simplify.md`
- `2026-06-29-audit-fixes.md`
- `2026-06-29-design-critique-fixes.md`
- `2026-06-29-phase2-nav-restructure.md`

**Superseded tasks (dropped):**
| Dropped | Reason |
|---|---|
| Audit T1 (spinner) | Replaced by Task 15 (static indicator — no new animations) |
| Audit T2 (side-panel layout animations) | Superseded by Task 13 (Phase 2 removes those panels) |
| Audit T6 (conditionally mount side panels) | Superseded by Task 13 (Phase 2 removes those panels) |
| Design Critique T5 (More dropdown) | Superseded by Task 11 (SettingsModal) |
| Design Critique T8 (duplicate BottomBar mode toggle) | Superseded by Task 10 (new BottomBar) |
| Design Critique T10 (More dropdown subtitles) | Superseded by Task 11 (SettingsModal nav labels) |

**Total: 25 tasks across 6 phases.**

---

## Phase 1 — IPC Refactor (Tasks 1–5)

Split the monolithic `src/renderer/ipc.ts` into domain modules so the graph can cluster them and so imports are explicit by domain. Move CronPanel out of Sidebar/ since it has zero sidebar-specific logic.

---

### Task 1: Create shared IPC core

**Files:** Create `src/renderer/ipc/index.ts`, `src/renderer/ipc/index.test.ts`

- [ ] **Step 1: Write `src/renderer/ipc/index.ts`**

```typescript
import { IPC } from "../../shared/ipc";

declare global {
  interface Window {
    ipc: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      on(channel: string, listener: (...args: unknown[]) => void): () => void;
      getPathForFile(file: File): string;
    };
  }
}

export let lastIpcError: Error | null = null;
export function clearIpcError() {
  lastIpcError = null;
}

export function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args).catch((err: Error) => {
    lastIpcError = err;
    console.error(`IPC ${channel} failed:`, err);
    throw err;
  }) as Promise<T>;
}

export function onIpcEvent<T>(channel: string, cb: (data: T) => void): () => void {
  return window.ipc.on(channel, cb as any);
}
```

- [ ] **Step 2: Write `src/renderer/ipc/index.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ipcInvoke, lastIpcError, clearIpcError } from "./index";

beforeEach(() => {
  clearIpcError();
  vi.restoreAllMocks();
});

it("calls window.ipc.invoke and returns result", async () => {
  (window as any).ipc = { invoke: vi.fn().mockResolvedValue("ok") };
  const result = await ipcInvoke<string>("test:chan", { x: 1 });
  expect(result).toBe("ok");
  expect((window as any).ipc.invoke).toHaveBeenCalledWith("test:chan", { x: 1 });
});

it("sets lastIpcError on failure", async () => {
  const err = new Error("fail");
  (window as any).ipc = { invoke: vi.fn().mockRejectedValue(err) };
  await expect(ipcInvoke("test:chan")).rejects.toThrow("fail");
  expect(lastIpcError).toBe(err);
});

it("clearIpcError resets the error", () => {
  clearIpcError();
  expect(lastIpcError).toBeNull();
});
```

- [ ] **Step 3:** Run `npx vitest run src/renderer/ipc/index.test.ts` — expect 3/3 PASS.
- [ ] **Step 4:** Commit: `feat(ipc): extract shared IPC core (ipcInvoke, onIpcEvent, lastIpcError)`

---

### Task 2: Create 14 domain IPC modules

**Files:** Create `src/renderer/ipc/chat.ts`, `conversation.ts`, `persona.ts`, `backend.ts`, `key.ts`, `pipeline.ts`, `attachment.ts`, `settings.ts`, `security.ts`, `cron.ts`, `mcp.ts`, `plugin.ts`, `update.ts`, `net.ts`

Each file imports `ipcInvoke`/`onIpcEvent` from `./index` and re-exports its domain functions. No tests needed — integration is verified when importers are updated in Task 3.

- [ ] **Step 1: Create `src/renderer/ipc/chat.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { MessageChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export async function sendChat(payload: any): Promise<string> {
  return ipcInvoke<string>(IPC.CHAT_SEND, payload);
}
export function onChatChunk(cb: (chunk: MessageChunk & { conversationId: string }) => void): () => void {
  return onIpcEvent(IPC.CHAT_CHUNK, cb);
}
export function onChatDone(cb: (payload: { conversationId: string; messageId: string }) => void): () => void {
  return onIpcEvent(IPC.CHAT_DONE, cb);
}
export async function abortChat(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.CHAT_ABORT, { conversationId });
}
```

- [ ] **Step 2: Create `src/renderer/ipc/conversation.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { Conversation, Message, SearchResult } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  return ipcInvoke<Conversation[]>(IPC.CONV_LIST, { limit, offset });
}
export async function createConversation(title: string, backend: string, personaId?: string): Promise<Conversation> {
  return ipcInvoke<Conversation>(IPC.CONV_CREATE, { title, backend, personaId });
}
export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return ipcInvoke<any>(IPC.CONV_GET, { conversationId });
}
export async function searchConversations(query: string): Promise<SearchResult[]> {
  return ipcInvoke<SearchResult[]>(IPC.CONV_SEARCH, { query });
}
export async function deleteConversation(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_DELETE, { conversationId: id });
}
export async function renameConversation(id: string, title: string): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_RENAME, { conversationId: id, title });
}
```

- [ ] **Step 3: Create `src/renderer/ipc/persona.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { Persona } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listPersonas(): Promise<Persona[]> {
  return ipcInvoke<Persona[]>(IPC.PERSONA_LIST);
}
export async function savePersona(p: Omit<Persona, "id"> & { id?: string }): Promise<Persona> {
  return ipcInvoke<Persona>(IPC.PERSONA_SAVE, p);
}
export async function deletePersona(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PERSONA_DELETE, { id });
}
```

- [ ] **Step 4: Create `src/renderer/ipc/backend.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { BackendInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listBackends(): Promise<BackendInfo[]> {
  return ipcInvoke<BackendInfo[]>(IPC.BACKEND_LIST);
}
export async function probeBackend(backend: string): Promise<{ available: boolean; authenticated: boolean }> {
  return ipcInvoke<any>(IPC.WIZARD_PROBE, { backend });
}
export async function installBackend(backend: string): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke<{ success: boolean; error?: string }>(IPC.WIZARD_INSTALL, { backend });
}
export async function markWizardDone(): Promise<void> {
  await ipcInvoke<void>(IPC.WIZARD_DONE);
}
```

- [ ] **Step 5: Create `src/renderer/ipc/key.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function storeKey(provider: string, key: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_STORE, { provider, key });
}
export async function getKey(provider: string): Promise<string | null> {
  return ipcInvoke<string | null>(IPC.KEY_GET, { provider });
}
export async function deleteKey(provider: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_DELETE, { provider });
}
export async function hasKey(provider: string): Promise<boolean> {
  return ipcInvoke<boolean>(IPC.KEY_HAS, { provider });
}
export async function listProviders(): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.KEY_LIST);
}
export async function getDefaultModel(provider: string): Promise<string> {
  return ipcInvoke<string>(IPC.MODEL_GET_DEFAULT, { provider });
}
export async function setDefaultModel(provider: string, model: string): Promise<void> {
  await ipcInvoke<void>(IPC.MODEL_SET_DEFAULT, { provider, model });
}
export async function listModels(provider: string): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.MODEL_LIST, { provider });
}
```

- [ ] **Step 6: Create `src/renderer/ipc/pipeline.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { PipelineTemplate, PipelineChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return ipcInvoke<PipelineTemplate[]>(IPC.PIPELINE_LIST);
}
export async function savePipelineTemplate(p: any): Promise<PipelineTemplate> {
  return ipcInvoke<PipelineTemplate>(IPC.PIPELINE_SAVE, p);
}
export async function deletePipelineTemplate(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_DELETE, { id });
}
export async function runPipeline(payload: { conversationId: string | null; message: string; templateId: string }): Promise<string> {
  return ipcInvoke<string>(IPC.PIPELINE_RUN, payload);
}
export async function abortPipeline(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_ABORT, { conversationId });
}
export function onPipelineChunk(cb: (chunk: PipelineChunk & { conversationId: string }) => void): () => void {
  return onIpcEvent(IPC.PIPELINE_CHUNK, cb);
}
export function onPipelineStepDone(cb: (payload: { conversationId: string; stepIndex: number }) => void): () => void {
  return onIpcEvent(IPC.PIPELINE_STEP_DONE, cb);
}
export function onPipelineDone(cb: (payload: { conversationId: string }) => void): () => void {
  return onIpcEvent(IPC.PIPELINE_DONE, cb);
}
```

- [ ] **Step 7: Create `src/renderer/ipc/attachment.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { Attachment } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function ingestAttachments(filePaths: string[], messageId: string): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_INGEST, { filePaths, messageId });
}
export async function listAttachments(messageId: string): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_LIST, { messageId });
}
export async function getAttachmentDataUrl(storedPath: string): Promise<string> {
  return ipcInvoke<string>(IPC.ATTACHMENT_DATA_URL, { storedPath });
}
```

- [ ] **Step 8: Create `src/renderer/ipc/settings.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function getAppVersion(): Promise<string> {
  return ipcInvoke<string>(IPC.APP_VERSION);
}
export async function getSetting(key: string): Promise<string | undefined> {
  return ipcInvoke<string | undefined>(IPC.SETTING_GET, { key });
}
export async function setSetting(key: string, value: string): Promise<void> {
  await ipcInvoke<void>(IPC.SETTING_SET, { key, value });
}
export async function getAllSettings(): Promise<Record<string, string>> {
  return ipcInvoke<Record<string, string>>(IPC.SETTING_GET_ALL);
}
```

- [ ] **Step 9: Create `src/renderer/ipc/security.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { SecurityEvent, SecurityRespondPayload } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export function onSecurityEvent(listener: (event: SecurityEvent) => void): () => void {
  return onIpcEvent(IPC.SECURITY_EVENT, listener);
}
export async function respondSecurity(payload: SecurityRespondPayload): Promise<void> {
  await ipcInvoke<void>(IPC.SECURITY_RESPOND, payload);
}
```

- [ ] **Step 10: Create `src/renderer/ipc/cron.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { CronJob, CronJobLog } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function getCronJobs(): Promise<CronJob[]> {
  return ipcInvoke<CronJob[]>(IPC.CRON_LIST);
}
export async function createCronJob(input: { name: string; cronExpression: string; prompt: string; backend: string }): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_CREATE, input);
}
export async function updateCronJob(id: string, changes: Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_UPDATE, { id, ...changes });
}
export async function deleteCronJob(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CRON_DELETE, { id });
}
export async function toggleCronJob(id: string): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_TOGGLE, { id });
}
export async function getCronJobLogs(cronJobId: string): Promise<CronJobLog[]> {
  return ipcInvoke<CronJobLog[]>(IPC.CRON_LOGS, { cronJobId });
}
export async function runCronJobNow(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CRON_RUN_NOW, { id });
}
```

- [ ] **Step 11: Create `src/renderer/ipc/mcp.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { McpServerConfig, McpTool, McpToolCallResult } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listMcpServers(): Promise<McpServerConfig[]> {
  return ipcInvoke<McpServerConfig[]>(IPC.MCP_LIST_SERVERS);
}
export async function addMcpServer(config: { name: string; command: string; args: string[]; env?: Record<string, string> }): Promise<McpServerConfig> {
  return ipcInvoke<McpServerConfig>(IPC.MCP_ADD_SERVER, config);
}
export async function removeMcpServer(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.MCP_REMOVE_SERVER, { id });
}
export async function toggleMcpServer(id: string): Promise<McpServerConfig | undefined> {
  return ipcInvoke<McpServerConfig | undefined>(IPC.MCP_TOGGLE_SERVER, { id });
}
export async function listMcpTools(): Promise<McpTool[]> {
  return ipcInvoke<McpTool[]>(IPC.MCP_LIST_TOOLS);
}
export async function callMcpTool(request: any): Promise<McpToolCallResult> {
  return ipcInvoke<McpToolCallResult>(IPC.MCP_CALL_TOOL, request);
}
```

- [ ] **Step 12: Create `src/renderer/ipc/plugin.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { PluginInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listPlugins(): Promise<PluginInfo[]> {
  return ipcInvoke<PluginInfo[]>(IPC.PLUGIN_LIST);
}
export async function togglePlugin(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_TOGGLE, { id });
}
export async function reloadPlugins(): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_RELOAD);
}
```

- [ ] **Step 13: Create `src/renderer/ipc/update.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke, onIpcEvent } from "./index";

export async function downloadUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_DOWNLOAD);
}
export async function installUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_INSTALL);
}
export function onUpdateAvailable(cb: (info: { version: string; releaseNotes: string }) => void): () => void {
  return onIpcEvent(IPC.UPDATE_AVAILABLE, cb);
}
export function onUpdateProgress(cb: (percent: number) => void): () => void {
  return onIpcEvent(IPC.UPDATE_PROGRESS, cb);
}
export function onUpdateDownloaded(cb: () => void): () => void {
  return onIpcEvent(IPC.UPDATE_DOWNLOADED, cb);
}
export function onUpdateError(cb: (message: string) => void): () => void {
  return onIpcEvent(IPC.UPDATE_ERROR, cb);
}
```

- [ ] **Step 14: Create `src/renderer/ipc/net.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function checkConnectivity(): Promise<{ online: boolean }> {
  return ipcInvoke<{ online: boolean }>(IPC.NET_CHECK);
}
export async function getProxySettings(): Promise<{ httpProxy: string; httpsProxy: string; noProxy: string }> {
  return ipcInvoke<{ httpProxy: string; httpsProxy: string; noProxy: string }>(IPC.NET_GET_PROXY);
}
export async function setProxySettings(settings: { httpProxy: string; httpsProxy: string; noProxy: string }): Promise<void> {
  await ipcInvoke(IPC.NET_SET_PROXY, settings);
}
```

- [ ] **Step 15:** Commit: `feat(ipc): split monolithic ipc.ts into 14 domain modules`

---

### Task 3: Update all importers and delete monolith

**Files:** 27 files that import from `../ipc` or `./ipc`

Mapping (file → new import path(s)):

| File | New import(s) |
|---|---|
| `hooks/useConversations.ts` | `../ipc/conversation` |
| `hooks/useBackends.ts` | `../ipc/backend` |
| `hooks/useAttachments.ts` | `../ipc/attachment` |
| `hooks/useMessages.ts` | `../ipc/conversation`, `../ipc/chat` |
| `hooks/usePersonas.ts` | `../ipc/persona` |
| `hooks/usePipelines.ts` | `../ipc/pipeline` |
| `hooks/usePipelineMessages.ts` | `../ipc/conversation`, `../ipc/pipeline` |
| `App.tsx` | `./ipc/conversation`, `./ipc/backend`, `./ipc/settings`, `./ipc/security`, `./ipc/net` |
| `components/DiagnosticBanner.tsx` | `../../ipc/index` |
| `components/UpdateBanner.tsx` | `../../ipc/update` |
| `components/Settings/SettingsPanel.tsx` | `../../ipc/settings`, `../../ipc/backend`, `../../ipc/key`, `../../ipc/net` |
| `components/Chat/AttachmentRow.tsx` | `../../ipc/attachment` |
| `components/Chat/MessageBubble.tsx` | `../../ipc/attachment` |
| `components/SearchPanel/SearchPanel.tsx` | `../../ipc/conversation` |
| `components/SearchPanel/SearchPanel.test.tsx` | `../../ipc/conversation` |
| `components/Sidebar/CronPanel.tsx` | `../../ipc/cron` |
| `components/Sidebar/CronPanel.test.tsx` | `../../ipc/cron` (update vi.mock path) |
| `components/Sidebar/McpPanel.tsx` | `../../ipc/mcp` |
| `components/Sidebar/McpPanel.test.tsx` | `../../ipc/mcp` (update vi.mock path) |
| `components/Sidebar/PluginPanel.tsx` | `../../ipc/plugin` |
| `components/Sidebar/PluginPanel.test.tsx` | `../../ipc/plugin` (update vi.mock path) |
| `components/Wizard/SetupWizard.tsx` | `../../ipc/backend` |
| `components/Wizard/WizardStep1.tsx` | `../../ipc/backend` |
| `components/Wizard/WizardStep2.tsx` | `../../ipc/backend` |
| `components/Wizard/WizardStep3.tsx` | `../../ipc/backend` |
| `components/Wizard/WizardStep3.test.tsx` | `../../ipc/backend` |

- [ ] **Step 1:** Update hooks (7 files) — update import lines.
- [ ] **Step 2:** Run `npx vitest run src/renderer/hooks/` — expect PASS.
- [ ] **Step 3:** Update components and test files (20 files) — update import lines and vi.mock paths.
- [ ] **Step 4:** Run `npx vitest run src/renderer/` — expect PASS.
- [ ] **Step 5:** Delete monolith: `git rm src/renderer/ipc.ts`
- [ ] **Step 6:** Run `npx vitest run` — expect PASS. Any missed importer produces a module-not-found error here.
- [ ] **Step 7:** Commit: `refactor(ipc): update 27 importers to domain modules, delete monolithic ipc.ts`

---

### Task 4: Move CronPanel to panels/

**Files:**
- Delete: `src/renderer/components/Sidebar/CronPanel.tsx`, `CronPanel.test.tsx`
- Create: `src/renderer/panels/CronPanel/CronPanel.tsx`, `CronPanel.test.tsx`
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx` — update import

IPC import path (`../../ipc/cron`) stays the same depth from `src/renderer/`.

- [ ] **Step 1:** `git rm src/renderer/components/Sidebar/CronPanel.tsx src/renderer/components/Sidebar/CronPanel.test.tsx`
- [ ] **Step 2:** Create `src/renderer/panels/CronPanel/CronPanel.tsx` — exact same content; update IPC import to `../../ipc/cron`.
- [ ] **Step 3:** Create `src/renderer/panels/CronPanel/CronPanel.test.tsx` — exact same content; update vi.mock path to `../../ipc/cron`.
- [ ] **Step 4:** In `Sidebar.tsx`, change `import { CronPanel } from "./CronPanel"` → `import { CronPanel } from "../../panels/CronPanel/CronPanel"`.
- [ ] **Step 5:** Run `npx vitest run src/renderer/panels/CronPanel/` — expect PASS.
- [ ] **Step 6:** Commit: `refactor(panels): move CronPanel from Sidebar/ to panels/CronPanel/`

---

### Task 5: Extract CronJobForm subcomponent

**Files:**
- Create: `src/renderer/panels/CronPanel/CronJobForm.tsx`
- Create: `src/renderer/panels/CronPanel/CronJobForm.test.tsx`
- Modify: `src/renderer/panels/CronPanel/CronPanel.tsx`

- [ ] **Step 1: Write `CronJobForm.test.tsx`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CronJobForm } from "./CronJobForm";

it("renders all form fields", () => {
  render(<CronJobForm onCreate={vi.fn()} />);
  expect(screen.getByPlaceholderText("e.g., Daily standup")).toBeTruthy();
  expect(screen.getByPlaceholderText("e.g., 0 9 * * 1-5")).toBeTruthy();
  expect(screen.getByPlaceholderText("Message to execute")).toBeTruthy();
  expect(screen.getByText("Create Job")).toBeTruthy();
});

it("calls onCreate with form values when submitted", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.change(screen.getByPlaceholderText("e.g., Daily standup"), { target: { value: "My Job" } });
  fireEvent.change(screen.getByPlaceholderText("e.g., 0 9 * * 1-5"), { target: { value: "* * * * *" } });
  fireEvent.change(screen.getByPlaceholderText("Message to execute"), { target: { value: "do thing" } });
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Job", cronExpression: "* * * * *", prompt: "do thing", backend: "claude" });
});

it("does not call onCreate when fields are empty", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2:** Run test — expect FAIL (module not found).

- [ ] **Step 3: Create `CronJobForm.tsx`**

```tsx
import { useState } from "react";

interface Props {
  onCreate: (input: { name: string; cronExpression: string; prompt: string; backend: string }) => void;
}

export function CronJobForm({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backend, setBackend] = useState("claude");

  const handleSubmit = () => {
    if (!name || !cronExpression || !prompt) return;
    onCreate({ name, cronExpression, prompt, backend });
    setName(""); setCronExpression(""); setPrompt(""); setBackend("claude");
  };

  return (
    <div className="px-3 py-2 space-y-1.5 border-b border-border">
      <label className="block text-xs font-medium" htmlFor="cron-name">Name</label>
      <input id="cron-name" placeholder="e.g., Daily standup" value={name} onChange={(e) => setName(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary" />
      <label className="block text-xs font-medium" htmlFor="cron-expr">Cron Expression</label>
      <input id="cron-expr" placeholder="e.g., 0 9 * * 1-5" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary" />
      <label className="block text-xs font-medium" htmlFor="cron-prompt">Prompt</label>
      <textarea id="cron-prompt" placeholder="Message to execute" value={prompt} onChange={(e) => setPrompt(e.target.value)}
        rows={2} className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary" />
      <label className="block text-xs font-medium" htmlFor="cron-backend">Backend</label>
      <select id="cron-backend" value={backend} onChange={(e) => setBackend(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary">
        <option value="claude">Claude Code</option>
        <option value="gemini">Gemini CLI</option>
        <option value="opencode">Opencode</option>
      </select>
      <button onClick={handleSubmit}
        className="w-full text-xs py-1 rounded bg-green-600 text-white hoverable:hover:bg-green-700 active:scale-95 transition-transform duration-100 ease-press">
        Create Job
      </button>
    </div>
  );
}
```

- [ ] **Step 4:** In `CronPanel.tsx`: add `import { CronJobForm } from "./CronJobForm"`. Replace the inline form section with `<CronJobForm onCreate={handleCreate} />`. Change `handleCreate` to accept the input as a parameter instead of reading local state.
- [ ] **Step 5:** Run `npx vitest run src/renderer/panels/CronPanel/` — expect all PASS.
- [ ] **Step 6:** Commit: `refactor(panels): extract CronJobForm subcomponent from CronPanel`

---

## Phase 2 — Design Tokens & Base Styles (Tasks 6–9)

These are prerequisites for the color-fix tasks in Phase 4 and must land before the nav restructure in Phase 3.

---

### Task 6: Add missing design tokens

**Files:** `src/renderer/index.css`, `tailwind.config.ts`

- [ ] **Step 1:** In `src/renderer/index.css`, add inside the `:root` block after `--c-danger-subtle`:
```css
  --c-danger-muted: 248 113 113;
  --c-surface-dark: 17 24 39;
  --c-surface-darker: 3 7 18;
```
And inside the `.dark` block after `--c-danger-subtle`:
```css
  --c-danger-muted: 248 113 113;
  --c-surface-dark: 17 24 39;
  --c-surface-darker: 3 7 18;
```

- [ ] **Step 2:** In `tailwind.config.ts`, add after the `danger-subtle` line:
```ts
"danger-muted": "rgb(var(--c-danger-muted) / <alpha-value>)",
"surface-dark": "rgb(var(--c-surface-dark) / <alpha-value>)",
"surface-darker": "rgb(var(--c-surface-darker) / <alpha-value>)",
```

- [ ] **Step 3:** Run `npx tsc --noEmit -p tsconfig.web.json` — expect PASS.
- [ ] **Step 4:** Commit: `feat: add missing design tokens (danger-muted, surface-dark, surface-darker)`

---

### Task 7: Fix muted text contrast (WCAG AA)

**Files:** `src/renderer/index.css`

- [ ] **Step 1:** In the `:root` block, change `--c-text-muted` from `156 163 175` → `107 114 128`.  
  This moves from `#9ca3af` (2.85:1) to `#6b7280` (4.6:1 on white) — passes WCAG AA SC 1.4.3.  
  The `.dark` block already has `107 114 128`; no change there.
- [ ] **Step 2:** Commit: `fix: darken text-muted in light mode to WCAG AA 4.5:1`

---

### Task 8: Fix focus-visible border-radius

**Files:** `src/renderer/index.css`

- [ ] **Step 1:** Find `:focus-visible` rule and change `border-radius: 2px` → `border-radius: 4px` (matches DESIGN.md `rounded.sm: 4px`).
- [ ] **Step 2:** Commit: `fix: align focus-visible border-radius with DESIGN.md scale (2px → 4px)`

---

### Task 9: Strip active:scale-95 from non-primary button classes

**Files:** `src/renderer/index.css`, `src/renderer/components/Sidebar/Sidebar.tsx`, `src/renderer/components/Chat/__tests__/InputBar.test.tsx`

- [ ] **Step 1:** In `index.css`, replace the `@layer components` btn classes:

```css
@layer components {
  .btn-sm {
    @apply text-xs px-2 py-1 rounded-md;
  }
  .btn-md {
    @apply text-sm px-3 py-1.5 rounded-lg;
  }
  .btn-lg {
    @apply w-full text-sm px-4 py-2 rounded-xl font-medium;
  }
}
```

- [ ] **Step 2:** Add `active:scale-95 transition-transform duration-100 ease-press` back explicitly on the `+ New` button in `Sidebar.tsx` (it's a primary action that should keep tactile feedback):
```tsx
<button onClick={onNew} className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark active:scale-95 transition-transform duration-100 ease-press">
```
Send/Stop buttons in `InputBar.tsx` already have it inline — no change needed. Welcome-screen "New conversation" button in `App.tsx` already has it inline — no change needed.

- [ ] **Step 3:** Run `npm test` — expect all passing.
- [ ] **Step 4:** Commit: `fix: remove active:scale-95 from non-primary button base classes; keep on primary actions`

---

## Phase 3 — Nav Restructure (Tasks 10–14)

Removes the top toolbar entirely. Controls move to a BottomBar; all secondary panels consolidate into a SettingsModal; Sidebar becomes conversations-only.

---

### Task 10: Create BottomBar component

**Files:** Create `src/renderer/components/Chat/BottomBar.tsx`, `BottomBar.test.tsx`

- [ ] **Step 1: Write failing test (`BottomBar.test.tsx`)**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomBar } from "./BottomBar";

vi.mock("../../ipc/backend", () => ({
  listBackends: vi.fn().mockResolvedValue([{ id: "claude", label: "Claude Code", available: true, authenticated: true }]),
  probeBackend: vi.fn().mockResolvedValue({ available: true, authenticated: true }),
}));
vi.mock("../../ipc/key", () => ({ listModels: vi.fn().mockResolvedValue([]) }));
vi.mock("../../ipc/persona", () => ({ listPersonas: vi.fn().mockResolvedValue([]) }));

const base = {
  mode: "single" as const, setMode: vi.fn(),
  backend: "claude", setBackend: vi.fn(),
  model: "", setModel: vi.fn(),
  personaId: null, setPersonaId: vi.fn(),
  templates: [], selectedTemplate: null, onTemplateSelect: vi.fn(),
  backendRefresh: 0,
};

describe("BottomBar", () => {
  it("renders Single and Pipeline mode buttons", () => {
    render(<BottomBar {...base} />);
    expect(screen.getByRole("button", { name: /^single$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^pipeline$/i })).toBeInTheDocument();
  });
  it("shows pipeline template combobox in pipeline mode", () => {
    render(<BottomBar {...base} mode="pipeline" />);
    expect(screen.getByRole("combobox", { name: /pipeline/i })).toBeInTheDocument();
  });
  it("shows persona combobox in single mode", () => {
    render(<BottomBar {...base} />);
    expect(screen.getByRole("combobox", { name: /persona/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2:** Run test — expect FAIL (module not found).

- [ ] **Step 3: Implement `BottomBar.tsx`**

```tsx
import { BackendSwitcher } from "../BackendSwitcher";
import { ModelSelector } from "../Toolbar/ModelSelector";
import { usePersonas } from "../../hooks/usePersonas";
import type { PipelineTemplate } from "../../../shared/types";

export interface BottomBarProps {
  mode: "single" | "pipeline";
  setMode: (m: "single" | "pipeline") => void;
  backend: string;
  setBackend: (b: string) => void;
  model: string;
  setModel: (m: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  templates: PipelineTemplate[];
  selectedTemplate: PipelineTemplate | null;
  onTemplateSelect: (t: PipelineTemplate | null) => void;
  backendRefresh: number;
  disabled?: boolean;
}

export function BottomBar({
  mode, setMode, backend, setBackend, model, setModel,
  personaId, setPersonaId, templates, selectedTemplate,
  onTemplateSelect, backendRefresh, disabled,
}: BottomBarProps) {
  const { personas } = usePersonas();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border overflow-x-auto flex-shrink-0">
      <div className="flex rounded-md border border-border-strong overflow-hidden text-xs flex-shrink-0">
        <button
          onClick={() => { setMode("single"); onTemplateSelect(null); }}
          disabled={disabled}
          aria-pressed={mode === "single"}
          className={`px-3 py-1 active:scale-95 transition-transform duration-100 ease-press ${mode === "single" ? "bg-primary text-on-primary" : "hoverable:hover:bg-bubble"}`}
        >
          Single
        </button>
        <button
          onClick={() => setMode("pipeline")}
          disabled={disabled}
          aria-pressed={mode === "pipeline"}
          className={`px-3 py-1 active:scale-95 transition-transform duration-100 ease-press ${mode === "pipeline" ? "bg-primary text-on-primary" : "hoverable:hover:bg-bubble"}`}
        >
          Pipeline
        </button>
      </div>

      {mode === "single" && (
        <>
          <div className="flex-shrink-0">
            <BackendSwitcher value={backend} onChange={setBackend} refreshTrigger={backendRefresh} />
          </div>
          <div className="flex-shrink-0">
            <ModelSelector provider={backend} value={model} onChange={setModel} />
          </div>
          <select
            aria-label="Persona"
            value={personaId ?? ""}
            onChange={(e) => setPersonaId(e.target.value || null)}
            disabled={disabled}
            className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
          >
            <option value="">No persona</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </>
      )}

      {mode === "pipeline" && (
        <select
          aria-label="Pipeline template"
          value={selectedTemplate?.id ?? ""}
          onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); onTemplateSelect(t ?? null); }}
          disabled={disabled}
          className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
        >
          <option value="">Select pipeline…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 4:** Run test — expect 3/3 PASS.
- [ ] **Step 5:** Run `npm run lint` — expect no errors.
- [ ] **Step 6:** Commit: `feat(ui): add BottomBar with mode/backend/persona/model selectors`

---

### Task 11: Create SettingsModal

**Files:** Create `src/renderer/components/Settings/SettingsModal.tsx`, `SettingsModal.test.tsx`

- [ ] **Step 1: Write failing test (`SettingsModal.test.tsx`)**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";

// Mock all ipc domains used by child panels
vi.mock("../../ipc/settings", () => ({ getSetting: vi.fn().mockResolvedValue(null), setSetting: vi.fn(), getAppVersion: vi.fn().mockResolvedValue("0.2.1"), getAllSettings: vi.fn().mockResolvedValue({}) }));
vi.mock("../../ipc/backend", () => ({ listBackends: vi.fn().mockResolvedValue([]), probeBackend: vi.fn().mockResolvedValue({ available: false, authenticated: false }) }));
vi.mock("../../ipc/key", () => ({ hasKey: vi.fn().mockResolvedValue(false), storeKey: vi.fn(), deleteKey: vi.fn(), listProviders: vi.fn().mockResolvedValue([]), getDefaultModel: vi.fn().mockResolvedValue(""), setDefaultModel: vi.fn(), listModels: vi.fn().mockResolvedValue([]) }));
vi.mock("../../ipc/net", () => ({ getProxySettings: vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }), setProxySettings: vi.fn(), checkConnectivity: vi.fn().mockResolvedValue({ online: true }) }));
vi.mock("../../ipc/persona", () => ({ listPersonas: vi.fn().mockResolvedValue([]), savePersona: vi.fn(), deletePersona: vi.fn() }));
vi.mock("../../ipc/pipeline", () => ({ listPipelineTemplates: vi.fn().mockResolvedValue([]), savePipelineTemplate: vi.fn(), deletePipelineTemplate: vi.fn() }));
vi.mock("../../ipc/mcp", () => ({ listMcpServers: vi.fn().mockResolvedValue([]), addMcpServer: vi.fn(), removeMcpServer: vi.fn(), toggleMcpServer: vi.fn(), listMcpTools: vi.fn().mockResolvedValue([]) }));
vi.mock("../../ipc/cron", () => ({ getCronJobs: vi.fn().mockResolvedValue([]), createCronJob: vi.fn(), toggleCronJob: vi.fn(), deleteCronJob: vi.fn(), getCronJobLogs: vi.fn().mockResolvedValue([]), runCronJobNow: vi.fn() }));
vi.mock("../../ipc/plugin", () => ({ listPlugins: vi.fn().mockResolvedValue([]), togglePlugin: vi.fn(), reloadPlugins: vi.fn() }));

const base = {
  open: true, section: "settings" as const,
  onClose: vi.fn(), onSectionChange: vi.fn(), onReRunWizard: vi.fn(),
  activePersonaId: null, onPersonaSelect: vi.fn(),
  activeTemplateId: null, onTemplateSelect: vi.fn(),
};

describe("SettingsModal", () => {
  it("renders when open=true", () => {
    render(<SettingsModal {...base} />);
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });
  it("does not render when open=false", () => {
    render(<SettingsModal {...base} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("calls onSectionChange when Personas nav item clicked", () => {
    const onSectionChange = vi.fn();
    render(<SettingsModal {...base} onSectionChange={onSectionChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^personas$/i }));
    expect(onSectionChange).toHaveBeenCalledWith("personas");
  });
  it("calls onClose when backdrop clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
  it("calls onClose when ✕ clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal {...base} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run test — expect FAIL (module not found).

- [ ] **Step 3: Implement `SettingsModal.tsx`**

```tsx
import { SettingsPanel } from "./SettingsPanel";
import { PersonaPanel } from "../Personas/PersonaPanel";
import { PipelinePanel } from "../Pipelines/PipelinePanel";
import { CronPanel } from "../../panels/CronPanel/CronPanel";
import { McpPanel } from "../Sidebar/McpPanel";
import { PluginPanel } from "../Sidebar/PluginPanel";
import type { PipelineTemplate } from "../../../shared/types";

export type SettingsSection = "settings" | "personas" | "pipelines" | "mcp" | "cron" | "plugins";

const NAV_ITEMS: { id: SettingsSection; label: string; description: string }[] = [
  { id: "settings", label: "Settings", description: "API keys, theme, proxy" },
  { id: "personas", label: "Personas", description: "System prompt profiles" },
  { id: "pipelines", label: "Pipelines", description: "Multi-step workflows" },
  { id: "mcp", label: "MCP Servers", description: "Connect external tools and data sources" },
  { id: "cron", label: "Cron Jobs", description: "Run conversations on a schedule" },
  { id: "plugins", label: "Plugins", description: "Extend MyRA with custom functionality" },
];

interface Props {
  open: boolean;
  section: SettingsSection;
  onClose: () => void;
  onSectionChange: (s: SettingsSection) => void;
  onReRunWizard: () => void;
  activePersonaId: string | null;
  onPersonaSelect: (id: string | null) => void;
  activeTemplateId: string | null;
  onTemplateSelect: (t: PipelineTemplate) => void;
}

export function SettingsModal({ open, section, onClose, onSectionChange, onReRunWizard, activePersonaId, onPersonaSelect, activeTemplateId, onTemplateSelect }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="settings-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className="relative bg-surface rounded-xl shadow-2xl flex overflow-hidden"
        style={{ width: "min(760px, 95vw)", height: "min(560px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close settings" className="absolute top-3 right-3 btn-sm border border-border-strong hoverable:hover:bg-bubble z-10">✕</button>
        <nav className="w-40 flex-shrink-0 border-r border-border bg-surface-subtle flex flex-col py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`text-left px-4 py-2.5 transition-colors ${section === item.id ? "bg-primary-ghost text-primary font-medium" : "text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble"}`}
            >
              <div className="text-xs font-medium">{item.label}</div>
              <div className="text-xs opacity-70 mt-0.5 leading-tight">{item.description}</div>
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-hidden">
          {section === "settings" && <SettingsPanel onClose={onClose} onReRunWizard={onReRunWizard} />}
          {section === "personas" && <PersonaPanel activePersonaId={activePersonaId} onSelect={onPersonaSelect} onClose={() => onSectionChange("settings")} />}
          {section === "pipelines" && <PipelinePanel activeTemplateId={activeTemplateId} onSelect={onTemplateSelect} onClose={() => onSectionChange("settings")} />}
          {section === "mcp" && <McpPanel />}
          {section === "cron" && <CronPanel />}
          {section === "plugins" && <PluginPanel />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4:** Run test — expect 5/5 PASS.
- [ ] **Step 5:** Run `npm run lint` — expect no errors.
- [ ] **Step 6:** Commit: `feat(ui): add SettingsModal with left nav and 6 sections`

---

### Task 12: Simplify Sidebar (conversations-only + gear footer)

**Files:** `src/renderer/components/Sidebar/Sidebar.tsx`, `src/renderer/components/Sidebar/ConvList.tsx`

Note: ConvList already has built-in search at lines 58–67; no new search UI needed.

- [ ] **Step 1:** In `ConvList.tsx`, remove `searchInputRef` from the Props interface, function parameters, and the `ref` callback on the `<input>` element.
- [ ] **Step 2:** Replace the full contents of `Sidebar.tsx`:

```tsx
import { GearSix } from "@phosphor-icons/react";
import { ConvList } from "./ConvList";

interface Props {
  collapsed: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  refreshTrigger?: number;
  onOpenSettings: () => void;
}

export function Sidebar({ collapsed, activeId, onSelect, onNew, onDelete, onRename, refreshTrigger, onOpenSettings }: Props) {
  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-border bg-surface-subtle ${collapsed ? "w-0" : "w-48 lg:w-64"}`}
      style={collapsed ? { minWidth: 0 } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">MyRA</span>
        <button onClick={onNew} className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark active:scale-95 transition-transform duration-100 ease-press">
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList activeId={activeId} onSelect={onSelect} onDelete={onDelete} onRename={onRename} refreshTrigger={refreshTrigger} />
      </div>
      <div className="border-t border-border p-2">
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble rounded-lg transition-colors"
        >
          <GearSix size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3:** Run `npx vitest run src/renderer/components/Sidebar/` — expect all PASS.
- [ ] **Step 4:** Run `npm run lint` — expect no errors.
- [ ] **Step 5:** Commit: `feat(ui): simplify sidebar to conversations-only with settings gear footer`

---

### Task 13: Rewire App.tsx + ChatView

**Files:** `src/renderer/App.tsx`, `src/renderer/components/Chat/ChatView.tsx`

- [ ] **Step 1:** In `ChatView.tsx`, add `bottomBar?: React.ReactNode` to the Props interface. Forward it through to both `SingleChatView` and `PipelineChatView`. In each, render `{bottomBar}` directly above `<InputBar>`.

- [ ] **Step 2:** In `App.tsx`:
  - **Remove imports:** `BackendSwitcher`, `ModelSelector`, `PersonaPanel`, `PipelinePanel`, `SettingsPanel`, `GearSix`, `MagnifyingGlass`, `SearchPanel`
  - **Add imports:** `BottomBar`, `SettingsModal`, `type SettingsSection`
  - **Remove state:** `showPersonas`, `showPipelines`, `showSettings`, `searchMode`, `showCron`, `showMCP`, `showPlugins`, `togglePanel`, `searchInputRef`
  - **Add state:** `const [settingsOpen, setSettingsOpen] = useState(false)` and `const [settingsSection, setSettingsSection] = useState<SettingsSection>("settings")`
  - **Remove** the Ctrl+F shortcut from `handleKeyDown`
  - **Delete** the entire `<nav aria-label="Toolbar">` block
  - **Delete** the PersonaPanel, PipelinePanel, and SettingsPanel slide-out divs from `<main>`
  - **Update both Sidebar calls** — remove 7 old props, add `onOpenSettings={() => { setSettingsOpen(true); setSettingsSection("settings"); }}`
  - **Pass `bottomBar` prop** to `ChatView` rendering a `<BottomBar>` instance
  - **Add `<SettingsModal>`** after the main flex div, before `<SecurityDialog>`

- [ ] **Step 3:** Run `npm run lint` — fix any unused import/variable errors.
- [ ] **Step 4:** Run `npm run build` — expect exits 0.
- [ ] **Step 5:** Run `npm test` — expect all passing.
- [ ] **Step 6:** Commit: `feat(ui): remove toolbar; wire BottomBar and SettingsModal into App`

---

### Task 14: Seed default personas + pipeline on first launch

**Files:** Create `src/main/store/defaults.ts`, `src/main/store/defaults.test.ts`; modify `src/main/index.ts`

- [ ] **Step 1:** Verify ConvStore API — read `src/main/store/index.ts` to confirm exact signatures for `savePersona` and `savePipelineTemplate` before implementing.

- [ ] **Step 2: Write `defaults.test.ts`**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./index", () => ({
  ConvStore: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    savePersona: vi.fn(),
    savePipelineTemplate: vi.fn(),
  },
}));

import { seedDefaults } from "./defaults";
import { ConvStore } from "./index";

describe("seedDefaults", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("seeds personas and pipeline when not yet seeded", () => {
    (ConvStore.getSetting as any).mockReturnValue(undefined);
    seedDefaults();
    expect(ConvStore.savePersona).toHaveBeenCalledTimes(2);
    expect(ConvStore.savePipelineTemplate).toHaveBeenCalledTimes(1);
    expect(ConvStore.setSetting).toHaveBeenCalledWith("defaults_seeded", "true");
  });

  it("does nothing when already seeded", () => {
    (ConvStore.getSetting as any).mockReturnValue("true");
    seedDefaults();
    expect(ConvStore.savePersona).not.toHaveBeenCalled();
    expect(ConvStore.savePipelineTemplate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3:** Run test — expect FAIL (module not found).

- [ ] **Step 4: Create `defaults.ts`**

```typescript
import { ConvStore } from "./index";

export function seedDefaults(): void {
  if (ConvStore.getSetting("defaults_seeded")) return;

  ConvStore.savePersona({
    name: "Coder",
    systemPrompt: "You are an expert software engineer. Be concise, use code blocks, prefer working solutions over explanations.",
    isDefault: true,
  });

  ConvStore.savePersona({
    name: "Explainer",
    systemPrompt: "You are a patient teacher. Explain concepts clearly using plain language and examples. Avoid jargon.",
    isDefault: false,
  });

  ConvStore.savePipelineTemplate({
    name: "Draft → Review",
    steps: [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "claude", personaId: null },
    ],
  });

  ConvStore.setSetting("defaults_seeded", "true");
}
```

- [ ] **Step 5:** Run test — expect 2/2 PASS.
- [ ] **Step 6:** In `src/main/index.ts`, add `import { seedDefaults } from "./store/defaults"` and call `seedDefaults()` immediately after `initDb(...)`.
- [ ] **Step 7:** Run `npm run build` and `npm test` — expect PASS.
- [ ] **Step 8:** Commit: `feat(main): seed default personas and pipeline on first launch`

---

## Phase 4 — Component Fixes (Tasks 15–21)

These are applied to the new structure from Phase 3.

---

### Task 15: Replace animated streaming dots with static indicator

**Files:** `src/renderer/components/Chat/MessageList.tsx`, `MessageList.test.tsx`

Design rule: animated loading states are prohibited as primary visual expressions. Use static `...`.

- [ ] **Step 1:** In `MessageList.test.tsx`, add:

```typescript
it("shows a static '...' indicator during streaming", () => {
  const { container } = render(<MessageList messages={[]} streaming={true} conversationId={null} />);
  const indicator = container.querySelector('[data-testid="streaming-indicator"]');
  expect(indicator).toBeTruthy();
  expect(indicator?.textContent).toBe("...");
  expect(indicator?.querySelectorAll('.animate-dot-fade').length).toBe(0);
});

it("hides indicator when not streaming", () => {
  const { container } = render(<MessageList messages={[]} streaming={false} conversationId={null} />);
  expect(container.querySelector('[data-testid="streaming-indicator"]')).toBeNull();
});
```

- [ ] **Step 2:** Run test — expect FAIL (no `data-testid="streaming-indicator"`).
- [ ] **Step 3:** In `MessageList.tsx`, replace the streaming indicator block with:

```tsx
{streaming && (
  <div className="flex justify-start mb-3">
    <div
      data-testid="streaming-indicator"
      className="bg-bubble rounded-2xl px-4 py-3 text-text-muted text-sm"
    >
      ...
    </div>
  </div>
)}
```

- [ ] **Step 4:** Run test — expect all PASS.
- [ ] **Step 5:** Commit: `fix: replace animated streaming dots with static indicator`

---

### Task 16: Add aria-label to InputBar textarea

**Files:** `src/renderer/components/Chat/InputBar.tsx`, `InputBar.test.tsx`

- [ ] **Step 1:** In `InputBar.test.tsx`, add:

```typescript
it("textarea has an accessible name", () => {
  render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
  const textarea = screen.getByRole("textbox");
  expect(textarea).toHaveAccessibleName();
});
```

- [ ] **Step 2:** Run test — expect FAIL.
- [ ] **Step 3:** In `InputBar.tsx`, add `aria-label="Message input"` to the `<textarea>` element.
- [ ] **Step 4:** Run test — expect PASS.
- [ ] **Step 5:** Commit: `fix: add aria-label to message input textarea`

---

### Task 17: Replace fixed max-w-[140px] in persona list

**Files:** `src/renderer/components/Personas/PersonaPanel.tsx`

- [ ] **Step 1:** Find `max-w-[140px]` on the persona description `<div>` and change to `max-w-[75%]`.
- [ ] **Step 2:** Commit: `fix: replace fixed max-w-[140px] with percentage in persona list`

---

### Task 18: Replace pulsing dot in pipeline tabs

**Files:** `src/renderer/components/Chat/ChatView.tsx`

- [ ] **Step 1:** Find `animate-pulse` on the pipeline step indicator span and remove the class (keep the span — just remove the animation).
- [ ] **Step 2:** Commit: `fix: remove animate-pulse from pipeline step indicator`

---

### Task 19: Replace hard-coded colors with design tokens

**Files:** `src/renderer/App.tsx`, `PersonaPanel.tsx`, `SettingsPanel.tsx`, `PipelinePanel.tsx`, `tailwind.config.ts`

Requires Task 6 (design tokens must exist first).

- [ ] **Step 1:** In `App.tsx`, replace the offline banner `bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700` → `bg-danger-subtle text-danger border-danger/30`. Replace scrim `bg-black/30` → `bg-surface-darker/50`.
- [ ] **Step 2:** In `PersonaPanel.tsx`:
  - `text-red-500` → `text-danger` (required asterisk)
  - `text-red-500 hoverable:hover:text-red-700` → `text-danger hoverable:hover:text-danger-dark`
  - `text-red-400 hoverable:hover:text-red-600` → `text-danger-muted hoverable:hover:text-danger`
- [ ] **Step 3:** In `SettingsPanel.tsx`, replace `border-red-*` / `text-red-*` on the remove button with `border-danger-muted text-danger hoverable:hover:bg-danger-subtle`.
- [ ] **Step 4:** In `PipelinePanel.tsx`, replace `text-red-400 hoverable:hover:text-red-600` → `text-danger-muted hoverable:hover:text-danger` (both instances).
- [ ] **Step 5:** In `tailwind.config.ts`, replace the hardcoded `backgroundColor: "rgb(17 24 39)"` (gray-900) in the `pre` typography config with `"rgb(var(--c-surface-dark) / <alpha-value>)"`.
- [ ] **Step 6:** Run `npm test` — expect all PASS.
- [ ] **Step 7:** Commit: `fix: replace hard-coded colors with design tokens throughout`

---

### Task 20: Replace text-red-500 with text-danger in PersonaPanel

**Note:** This is fully covered by Task 19 Step 2. No separate task needed — mark complete when Task 19 is done.

- [x] ~~Covered by Task 19~~

---

### Task 21: Focus trap + Escape on mobile sidebar drawer

**Files:** `src/renderer/App.tsx`

- [ ] **Step 1:** Add `ref={mobileSidebarRef}` to the mobile sidebar wrapper div (`const mobileSidebarRef = useRef<HTMLDivElement>(null)`).
- [ ] **Step 2:** Add `useFocusTrap(mobileSidebarRef, !sidebarCollapsed && !viewportLg, sidebarCollapsed)` after existing hooks.
- [ ] **Step 3:** Replace scrim `<div>` with:

```tsx
<div
  className="fixed inset-0 z-30 bg-surface-darker/50"
  onClick={() => setSidebarCollapsed(true)}
  onKeyDown={(e) => { if (e.key === "Escape") setSidebarCollapsed(true); }}
  role="presentation"
/>
```

- [ ] **Step 4:** Run `npm test` — expect PASS.
- [ ] **Step 5:** Commit: `fix: add focus trap and Escape handler to mobile sidebar drawer`

---

## Phase 5 — Behavior Improvements (Tasks 22–24)

---

### Task 22: Add inline delete confirmation to ConvItem

**Files:** `src/renderer/components/Sidebar/ConvItem.tsx`; create `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConvItem } from "../ConvItem";

const baseConv = { id: "conv-1", title: "Test Conversation", backend: "claude", createdAt: Date.now(), updatedAt: Date.now(), pipelineTemplateId: null };

describe("ConvItem delete confirmation", () => {
  it("shows confirm state on first delete click, does not call onDelete", async () => {
    const onDelete = vi.fn();
    render(<ConvItem conversation={baseConv} active={false} onClick={vi.fn()} onDelete={onDelete} onRename={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /delete conversation/i }));
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete after confirmation click", async () => {
    const onDelete = vi.fn();
    render(<ConvItem conversation={baseConv} active={false} onClick={vi.fn()} onDelete={onDelete} onRename={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /delete conversation/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("conv-1");
  });

  it("resets confirm state when conversation id changes", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(<ConvItem conversation={baseConv} active={false} onClick={vi.fn()} onDelete={onDelete} onRename={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /delete conversation/i }));
    rerender(<ConvItem conversation={{ ...baseConv, id: "conv-2" }} active={false} onClick={vi.fn()} onDelete={onDelete} onRename={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /confirm delete/i })).toBeNull();
  });
});
```

- [ ] **Step 2:** Run test — expect FAIL.
- [ ] **Step 3:** In `ConvItem.tsx`:
  - Add `const [confirmDelete, setConfirmDelete] = useState(false)` state.
  - Add `useEffect(() => { setConfirmDelete(false); }, [conversation.id])`.
  - Replace the delete button with a two-state toggle: first click shows "Confirm? / ✕", second confirm click calls `onDelete`.
- [ ] **Step 4:** Run test — expect 3/3 PASS.
- [ ] **Step 5:** Commit: `fix: add inline delete confirmation to conversation items`

---

### Task 23: Replace alert() with inline feedback in SettingsPanel

**Files:** `src/renderer/components/Settings/SettingsPanel.tsx`, `SettingsPanel.test.tsx`

- [ ] **Step 1:** Add `testResults` state: `const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({})`.
- [ ] **Step 2:** Replace the `handleTest` function — instead of `alert(...)`, set `testResults[provider]`. Auto-clear successes after 5 seconds with `setTimeout`.
- [ ] **Step 3:** Render inline result text next to each Test button: `{testResults[p.id] && <span className={...}>{testResults[p.id].message}</span>}`.
- [ ] **Step 4:** In `SettingsPanel.test.tsx`, add mock for `probeBackend` and tests asserting inline feedback text appears (and `alert` is NOT called).
- [ ] **Step 5:** Run test — expect PASS.
- [ ] **Step 6:** Commit: `fix: replace alert() with inline test-result feedback in Settings`

---

### Task 24: Add ErrorToast for send failures

**Files:** Create `src/renderer/components/Chat/ErrorToast.tsx`; modify `src/renderer/components/Chat/ChatView.tsx`

- [ ] **Step 1: Create `ErrorToast.tsx`**

```tsx
import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

interface Props {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function ErrorToast({ message, onDismiss, duration = 8000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-danger text-on-primary text-sm rounded-xl shadow-lg" role="alert">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss error" className="p-0.5 hoverable:hover:opacity-80">
        <X size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2:** Write `ErrorToast.test.tsx` — verify message renders, dismiss button calls `onDismiss`, role="alert" is present.
- [ ] **Step 3:** In `SingleChatView`, add `const [sendError, setSendError] = useState<string | null>(null)`. Wrap `handleSend` in try/catch that sets `sendError`. Render `{sendError && <div className="px-4 pt-2"><ErrorToast message={sendError} onDismiss={() => setSendError(null)} /></div>}` above `<InputBar>`.
- [ ] **Step 4:** Run `npm test` — expect all PASS.
- [ ] **Step 5:** Commit: `feat: add ErrorToast component for send failure feedback`

---

## Phase 6 — Verification (Task 25)

### Task 25: Final verification

- [ ] **Step 1:** `npm test` — all tests pass.
- [ ] **Step 2:** `npm run lint` — zero errors.
- [ ] **Step 3:** `npm run build` — exits 0.
- [ ] **Step 4:** Manual smoke-test checklist:
  - No top toolbar visible after wizard
  - BottomBar shows below messages — mode, backend, model, persona selectors present
  - ⚙ gear in sidebar footer opens SettingsModal
  - SettingsModal left nav switches between all 6 sections
  - Backdrop and ✕ close the modal
  - Conversation list search works inline in sidebar
  - Delete a conversation — confirm step appears before deletion
  - Test a backend in Settings — inline result appears, no browser alert()
  - Send a message — streaming shows static `...` indicator
  - Fresh DB: 2 default personas and 1 pipeline appear in Settings

---

## Task Map

| # | Phase | Task | Source |
|---|---|---|---|
| 1 | IPC | Create shared IPC core | ipc-simplify T1 |
| 2 | IPC | Create 14 domain IPC modules | ipc-simplify T2 |
| 3 | IPC | Update 27 importers + delete monolith | ipc-simplify T3 |
| 4 | IPC | Move CronPanel to panels/ | ipc-simplify T4 |
| 5 | IPC | Extract CronJobForm | ipc-simplify T5 |
| 6 | Tokens | Add missing design tokens | audit T0 |
| 7 | Tokens | Fix muted text contrast WCAG AA | audit T3 |
| 8 | Tokens | Fix focus-visible border-radius | design-critique T6 |
| 9 | Tokens | Strip active:scale-95 from non-primary buttons | design-critique T1 |
| 10 | Nav | Create BottomBar | phase2 T1 |
| 11 | Nav | Create SettingsModal | phase2 T2 |
| 12 | Nav | Simplify Sidebar | phase2 T3 |
| 13 | Nav | Rewire App.tsx + ChatView | phase2 T4 |
| 14 | Nav | Seed default content | phase2 T5 |
| 15 | Components | Static streaming indicator | design-critique T2 |
| 16 | Components | aria-label on InputBar textarea | audit T7 |
| 17 | Components | Fix max-w-[140px] in persona list | audit T8 |
| 18 | Components | Remove pulsing dot in pipeline tabs | audit T9 |
| 19 | Components | Replace hard-coded colors with tokens | audit T5 + design-critique T7 |
| 20 | Components | ~~text-red-500~~ (covered by 19) | — |
| 21 | Components | Focus trap + Escape on mobile sidebar | audit T4 |
| 22 | Behavior | Inline delete confirmation on ConvItem | design-critique T3 |
| 23 | Behavior | Inline feedback in SettingsPanel | design-critique T4 |
| 24 | Behavior | ErrorToast for send failures | design-critique T9 |
| 25 | Verify | Final verification | — |
