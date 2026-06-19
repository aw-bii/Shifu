# Task 2 Brief: Shared Types + IPC Contract

## Global Constraints

- IPC channel names imported from `src/shared/ipc.ts` — no raw string literals elsewhere.
- `BackendAdapter.send()` must return `AsyncIterable<MessageChunk>` and respect `abort()`.
- `crypto.randomUUID()` for all ID generation (Node 14.17+ built-in).
- Tech stack: Electron (latest), React 18, TypeScript (strict).

## Task 2: Shared Types + IPC Contract

**Files:**

- Overwrite: `src/shared/types.ts` (stub exists from Task 1 — replace with full spec version)
- Overwrite: `src/shared/ipc.ts` (stub exists from Task 1 — replace with full spec version)

**Interfaces:**

- Produces: the typed contract used by both main and renderer in every subsequent task.

- [ ] **Step 1: Write `src/shared/types.ts`**

```typescript
export interface Conversation {
  id: string
  title: string
  backend: string
  personaId: string | null
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  backend: string
  createdAt: number
}

export interface Persona {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
}

export interface BackendInfo {
  id: string
  label: string
  available: boolean
  authenticated: boolean
}

export interface MessageChunk {
  type: 'text' | 'tool_use' | 'error' | 'done'
  content: string
  raw?: unknown
}

export interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string): AsyncIterable<MessageChunk>
  abort(): void
}
```

- [ ] **Step 2: Write `src/shared/ipc.ts`**

```typescript
export const IPC = {
  CHAT_SEND:      'chat:send',
  CHAT_CHUNK:     'chat:chunk',
  CHAT_DONE:      'chat:done',
  CHAT_ABORT:     'chat:abort',
  CONV_LIST:      'conv:list',
  CONV_GET:       'conv:get',
  CONV_SEARCH:    'conv:search',
  PERSONA_LIST:   'persona:list',
  PERSONA_SAVE:   'persona:save',
  PERSONA_DELETE: 'persona:delete',
  BACKEND_LIST:   'backend:list',
  WIZARD_PROBE:   'wizard:probe',
  WIZARD_INSTALL: 'wizard:install',
  WIZARD_DONE:    'wizard:done',
} as const

export type IpcChannels = typeof IPC

// Payload types per channel (Renderer → Main, invoke/handle)
export interface IpcInvokeMap {
  [IPC.CHAT_SEND]:      { conversationId: string | null; message: string; backend: string; personaId?: string }
  [IPC.CHAT_ABORT]:     { conversationId: string }
  [IPC.CONV_LIST]:      { limit: number; offset: number }
  [IPC.CONV_GET]:       { conversationId: string }
  [IPC.CONV_SEARCH]:    { query: string }
  [IPC.PERSONA_LIST]:   void
  [IPC.PERSONA_SAVE]:   { id?: string; name: string; systemPrompt: string; isDefault: boolean }
  [IPC.PERSONA_DELETE]: { id: string }
  [IPC.BACKEND_LIST]:   void
  [IPC.WIZARD_PROBE]:   { backend: string }
  [IPC.WIZARD_INSTALL]: { backend: string }
  [IPC.WIZARD_DONE]:    void
}

// Push channels (Main → Renderer, webContents.send)
export interface IpcPushMap {
  [IPC.CHAT_CHUNK]: import('./types').MessageChunk & { conversationId: string }
  [IPC.CHAT_DONE]:  { conversationId: string; messageId: string }
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json
```

Expected: both exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat: shared types and IPC channel contract"
```
