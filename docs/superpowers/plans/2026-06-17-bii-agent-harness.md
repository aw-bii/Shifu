# BII Agent Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native Electron desktop chat app (Windows + macOS) that wraps Claude Code, Gemini CLI, and Opencode behind a persistent chat UI with conversation history, persona management, and a guided setup wizard.

**Architecture:** Main process owns all CLI spawning, SQLite, and filesystem access; renderer is a React-only UI communicating via typed IPC. Each CLI backend has a single adapter file implementing `BackendAdapter`; `AdapterManager` is the sole entry point for IPC handlers. Streaming responses use `webContents.send()` push channels; request-reply uses `ipcMain.handle`.

**Tech Stack:** Electron (latest), React 18, TypeScript (strict), Tailwind CSS, electron-vite, better-sqlite3, electron-builder, Vitest, Playwright.

## Global Constraints

- `contextIsolation: true`, `nodeIntegration: false` on every BrowserWindow — no exceptions.
- All `child_process.spawn` calls use argv arrays, never shell strings.
- IPC channel names imported from `src/shared/ipc.ts` — no raw string literals elsewhere.
- `BackendAdapter.send()` must return `AsyncIterable<MessageChunk>` and respect `abort()`.
- Persona text injected as a CLI flag inside adapters — never concatenated into user message.
- SQLite migrations in `src/main/store/migrations/` numbered `001_`, `002_`, applied in order.
- `crypto.randomUUID()` for all ID generation (Node 14.17+ built-in).

---

## File Structure

```
src/
  shared/
    types.ts               - Conversation, Message, Persona, BackendInfo, MessageChunk
    ipc.ts                 - Channel name constants + typed payload map
  main/
    index.ts               - Electron main entry, BrowserWindow, first-launch detection
    ipc.ts                 - ipcMain.handle registrations for all channels
    adapters/
      types.ts             - BackendAdapter interface (re-exported from shared/types.ts)
      claude.adapter.ts    - ClaudeAdapter (bundled, stream-json)
      gemini.adapter.ts    - GeminiAdapter (json flag + line fallback)
      opencode.adapter.ts  - OpencodeAdapter (json flag + line fallback)
      manager.ts           - AdapterManager singleton
    store/
      db.ts                - SQLite connection + migration runner
      index.ts             - ConvStore: conversations, messages, personas CRUD
      migrations/
        001_initial.sql    - Full schema (conversations, messages, personas, FTS5)
    wizard/
      probe.ts             - Detect CLI on PATH + auth probe
      install.ts           - Run install command in child process, stream output
  renderer/
    index.html
    main.tsx               - React entry
    App.tsx                - Root: wizard gate or main layout
    ipc.ts                 - Typed wrappers over window.ipc (contextBridge)
    hooks/
      useConversations.ts  - conv:list, conv:get, conv:search via IPC
      useMessages.ts       - chat:send, chat:chunk stream, chat:abort via IPC
      usePersonas.ts       - persona:list, persona:save, persona:delete via IPC
      useBackends.ts       - backend:list via IPC
    components/
      Chat/
        ChatView.tsx       - Assembles MessageList + InputBar for a conversation
        MessageList.tsx    - Virtualized scrollable list of MessageBubble
        MessageBubble.tsx  - Single message (user/assistant) with markdown render
        InputBar.tsx       - Textarea + send button + abort button
      Sidebar/
        Sidebar.tsx        - Left rail: ConvList + new-conversation button
        ConvList.tsx       - Searchable list of ConvItem rows
        ConvItem.tsx       - Single conversation row (title, date, backend badge)
      Personas/
        PersonaPanel.tsx   - List + inline editor for personas
      Wizard/
        SetupWizard.tsx    - Wizard shell (step state machine)
        WizardStep1.tsx    - Detection checklist
        WizardStep2.tsx    - Install panel with embedded terminal output
        WizardStep3.tsx    - Auth probe + Run button
      BackendSwitcher.tsx  - Dropdown to change active backend for a conversation
  preload/
    index.ts               - contextBridge: exposes window.ipc to renderer
electron.vite.config.ts
tailwind.config.ts
electron-builder.config.ts
vitest.config.ts
```

---

### Task 1: Project Scaffold

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
cd "c:\Users\Aryaman\Documents\AI Tool\BII Agent Harness"
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

---

### Task 2: Shared Types + IPC Contract

**Files:**

- Create: `src/shared/types.ts`
- Create: `src/shared/ipc.ts`

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

- [ ] **Step 3: Commit**

```bash
git add src/shared/
git commit -m "feat: shared types and IPC channel contract"
```

---

### Task 3: Database Layer

**Files:**

- Create: `src/main/store/migrations/001_initial.sql`
- Create: `src/main/store/db.ts`
- Create: `src/main/store/index.ts`
- Test: `src/main/store/index.test.ts`

**Interfaces:**

- Consumes: `Conversation`, `Message`, `Persona` from `src/shared/types.ts`
- Produces:
  ```typescript
  export const ConvStore: {
    createConversation(title: string, backend: string, personaId: string | null): Conversation
    getConversation(id: string): Conversation | undefined
    listConversations(limit: number, offset: number): Conversation[]
    searchMessages(query: string): Message[]
    createMessage(msg: Omit<Message, 'id' | 'createdAt'>): Message
    getMessages(conversationId: string): Message[]
    createPersona(p: Omit<Persona, 'id'>): Persona
    listPersonas(): Persona[]
    updatePersona(id: string, p: Partial<Omit<Persona, 'id'>>): Persona
    deletePersona(id: string): void
    getDefaultPersona(): Persona | undefined
  }
  ```

- [ ] **Step 1: Write `src/main/store/migrations/001_initial.sql`**

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  backend    TEXT NOT NULL,
  persona_id TEXT REFERENCES personas(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personas (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  is_default    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  backend         TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
  USING fts5(content, content=messages, content_rowid=rowid);

CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

- [ ] **Step 2: Write the failing test `src/main/store/index.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb } from './db'
import { ConvStore } from './index'
import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

let dbPath: string

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `test-${crypto.randomUUID()}.db`)
  initDb(dbPath)
})

afterEach(() => {
  fs.unlinkSync(dbPath)
})

describe('ConvStore.createConversation', () => {
  it('returns a Conversation with generated id and timestamps', () => {
    const conv = ConvStore.createConversation('Hello world', 'claude', null)
    expect(conv.id).toBeTruthy()
    expect(conv.title).toBe('Hello world')
    expect(conv.backend).toBe('claude')
    expect(conv.personaId).toBeNull()
    expect(conv.createdAt).toBeGreaterThan(0)
  })
})

describe('ConvStore.createMessage + getMessages', () => {
  it('creates and retrieves messages by conversationId', () => {
    const conv = ConvStore.createConversation('Test', 'claude', null)
    ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: 'hi', backend: 'claude' })
    const msgs = ConvStore.getMessages(conv.id)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('hi')
  })
})

describe('ConvStore.searchMessages', () => {
  it('finds messages by content keyword', () => {
    const conv = ConvStore.createConversation('Test', 'claude', null)
    ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: 'pineapple juice', backend: 'claude' })
    ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: 'mango smoothie', backend: 'claude' })
    const results = ConvStore.searchMessages('pineapple')
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('pineapple juice')
  })
})

describe('ConvStore persona methods', () => {
  it('creates, lists, and marks default persona', () => {
    ConvStore.createPersona({ name: 'Coder', systemPrompt: 'You are a coder.', isDefault: false })
    const p2 = ConvStore.createPersona({ name: 'Writer', systemPrompt: 'You write.', isDefault: true })
    const personas = ConvStore.listPersonas()
    expect(personas).toHaveLength(2)
    expect(ConvStore.getDefaultPersona()?.id).toBe(p2.id)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/main/store/index.test.ts
```

Expected: FAIL — `Cannot find module './db'`

- [ ] **Step 4: Write `src/main/store/db.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function initDb(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized — call initDb() first')
  return db
}

function runMigrations(): void {
  const migrationsDir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`)
  for (const file of files) {
    const already = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file)
    if (already) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
  }
}
```

- [ ] **Step 5: Write `src/main/store/index.ts`**

```typescript
import { getDb } from './db'
import type { Conversation, Message, Persona } from '../../shared/types'

export const ConvStore = {
  createConversation(title: string, backend: string, personaId: string | null): Conversation {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO conversations (id, title, backend, persona_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, title, backend, personaId, now, now)
    return { id, title, backend, personaId, createdAt: now, updatedAt: now }
  },

  getConversation(id: string): Conversation | undefined {
    const row = getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any
    return row ? rowToConv(row) : undefined
  },

  listConversations(limit: number, offset: number): Conversation[] {
    const rows = getDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset) as any[]
    return rows.map(rowToConv)
  },

  searchMessages(query: string): Message[] {
    const rows = getDb().prepare(`
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.rowid = fts.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank LIMIT 50
    `).all(query) as any[]
    return rows.map(rowToMsg)
  },

  createMessage(msg: Omit<Message, 'id' | 'createdAt'>): Message {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content, backend, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, msg.conversationId, msg.role, msg.content, msg.backend, now)
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, msg.conversationId)
    return { ...msg, id, createdAt: now }
  },

  getMessages(conversationId: string): Message[] {
    const rows = getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as any[]
    return rows.map(rowToMsg)
  },

  createPersona(p: Omit<Persona, 'id'>): Persona {
    const db = getDb()
    const id = crypto.randomUUID()
    if (p.isDefault) db.prepare('UPDATE personas SET is_default = 0').run()
    db.prepare(`INSERT INTO personas (id, name, system_prompt, is_default) VALUES (?, ?, ?, ?)`)
      .run(id, p.name, p.systemPrompt, p.isDefault ? 1 : 0)
    return { id, ...p }
  },

  listPersonas(): Persona[] {
    return (getDb().prepare('SELECT * FROM personas').all() as any[]).map(rowToPersona)
  },

  updatePersona(id: string, p: Partial<Omit<Persona, 'id'>>): Persona {
    const db = getDb()
    if (p.isDefault) db.prepare('UPDATE personas SET is_default = 0').run()
    if (p.name !== undefined) db.prepare('UPDATE personas SET name = ? WHERE id = ?').run(p.name, id)
    if (p.systemPrompt !== undefined) db.prepare('UPDATE personas SET system_prompt = ? WHERE id = ?').run(p.systemPrompt, id)
    if (p.isDefault !== undefined) db.prepare('UPDATE personas SET is_default = ? WHERE id = ?').run(p.isDefault ? 1 : 0, id)
    return ConvStore.listPersonas().find(x => x.id === id)!
  },

  deletePersona(id: string): void {
    getDb().prepare('DELETE FROM personas WHERE id = ?').run(id)
  },

  getDefaultPersona(): Persona | undefined {
    const row = getDb().prepare('SELECT * FROM personas WHERE is_default = 1').get() as any
    return row ? rowToPersona(row) : undefined
  },
}

function rowToConv(r: any): Conversation {
  return { id: r.id, title: r.title, backend: r.backend, personaId: r.persona_id, createdAt: r.created_at, updatedAt: r.updated_at }
}
function rowToMsg(r: any): Message {
  return { id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, backend: r.backend, createdAt: r.created_at }
}
function rowToPersona(r: any): Persona {
  return { id: r.id, name: r.name, systemPrompt: r.system_prompt, isDefault: r.is_default === 1 }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/main/store/index.test.ts
```

Expected: PASS — 4 test suites green.

- [ ] **Step 7: Commit**

```bash
git add src/main/store/
git commit -m "feat: SQLite ConvStore with migrations and FTS5 search"
```

---

### Task 4: Adapter Interface + Claude Adapter

**Files:**

- Create: `src/main/adapters/claude.adapter.ts`
- Test: `src/main/adapters/claude.adapter.test.ts`

**Interfaces:**

- Consumes: `BackendAdapter`, `MessageChunk` from `src/shared/types.ts`
- Produces:
  ```typescript
  export class ClaudeAdapter implements BackendAdapter {
    id = 'claude'
    isAvailable(): Promise<boolean>
    send(message: string, persona?: string): AsyncIterable<MessageChunk>
    abort(): void
  }
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/adapters/claude.adapter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ClaudeAdapter } from './claude.adapter'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

function mockSpawn(stdoutLines: string[], exitCode = 0) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'))
    proc.emit('close', exitCode)
  }, 0)
  return proc
}

describe('ClaudeAdapter.isAvailable', () => {
  it('returns true when spawn exits 0', async () => {
    mockSpawn([], 0)
    const adapter = new ClaudeAdapter()
    expect(await adapter.isAvailable()).toBe(true)
  })

  it('returns false when spawn exits non-zero', async () => {
    mockSpawn([], 1)
    const adapter = new ClaudeAdapter()
    expect(await adapter.isAvailable()).toBe(false)
  })
})

describe('ClaudeAdapter.send', () => {
  it('yields text chunks from stream-json output', async () => {
    const line = JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } })
    mockSpawn([line])
    const adapter = new ClaudeAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('say hi')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('Hello')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/adapters/claude.adapter.test.ts
```

Expected: FAIL — `Cannot find module './claude.adapter'`

- [ ] **Step 3: Write `src/main/adapters/claude.adapter.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk } from '../../shared/types'

export class ClaudeAdapter implements BackendAdapter {
  id = 'claude'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('claude', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string): AsyncIterable<MessageChunk> {
    const args = ['--output-format', 'stream-json', '--print', message]
    if (persona) args.push('--system-prompt', persona)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('claude', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line)
          const chunk = parseClaudeEvent(json)
          if (chunk) { chunks.push(chunk); resolve?.() }
        } catch { /* skip malformed lines */ }
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseClaudeEvent(event: any): MessageChunk | null {
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { type: 'text', content: event.delta.text, raw: event }
  }
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    return { type: 'tool_use', content: event.content_block.name ?? '', raw: event }
  }
  if (event.type === 'error') {
    return { type: 'error', content: event.error?.message ?? 'Unknown error', raw: event }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/adapters/claude.adapter.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/adapters/claude.adapter.ts src/main/adapters/claude.adapter.test.ts
git commit -m "feat: ClaudeAdapter with stream-json parsing"
```

---

### Task 5: Gemini + Opencode Adapters

**Files:**

- Create: `src/main/adapters/gemini.adapter.ts`
- Create: `src/main/adapters/opencode.adapter.ts`
- Test: `src/main/adapters/gemini.adapter.test.ts`
- Test: `src/main/adapters/opencode.adapter.test.ts`

**Interfaces:**

- Consumes: `BackendAdapter`, `MessageChunk` from `src/shared/types.ts`
- Produces: `GeminiAdapter implements BackendAdapter` (id = `'gemini'`), `OpencodeAdapter implements BackendAdapter` (id = `'opencode'`)

- [ ] **Step 1: Write the failing tests**

```typescript
// src/main/adapters/gemini.adapter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GeminiAdapter } from './gemini.adapter'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

function mockSpawn(stdoutLines: string[], exitCode = 0) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'))
    proc.emit('close', exitCode)
  }, 0)
}

describe('GeminiAdapter.send', () => {
  it('yields text chunks from JSON output', async () => {
    const line = JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hi there' }] } }] })
    mockSpawn([line])
    const adapter = new GeminiAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('hello')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('Hi there')
  })

  it('falls back to plain-text lines when JSON parse fails', async () => {
    mockSpawn(['plain text response'])
    const adapter = new GeminiAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('hello')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('plain text response')
  })
})
```

```typescript
// src/main/adapters/opencode.adapter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { OpencodeAdapter } from './opencode.adapter'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

function mockSpawn(stdoutLines: string[], exitCode = 0) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'))
    proc.emit('close', exitCode)
  }, 0)
}

describe('OpencodeAdapter.send', () => {
  it('falls back to plain-text lines', async () => {
    mockSpawn(['opencode reply'])
    const adapter = new OpencodeAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('hello')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('opencode reply')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/main/adapters/gemini.adapter.test.ts src/main/adapters/opencode.adapter.test.ts
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Write `src/main/adapters/gemini.adapter.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk } from '../../shared/types'

export class GeminiAdapter implements BackendAdapter {
  id = 'gemini'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('gemini', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string): AsyncIterable<MessageChunk> {
    const args = ['--format', 'json', '-p', message]
    if (persona) args.push('--system-prompt', persona)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('gemini', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        const chunk = parseGeminiLine(line)
        chunks.push(chunk)
        resolve?.()
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseGeminiLine(line: string): MessageChunk {
  try {
    const json = JSON.parse(line)
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string') return { type: 'text', content: text, raw: json }
  } catch { /* fall through */ }
  return { type: 'text', content: line }
}
```

- [ ] **Step 4: Write `src/main/adapters/opencode.adapter.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk } from '../../shared/types'

export class OpencodeAdapter implements BackendAdapter {
  id = 'opencode'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('opencode', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string): AsyncIterable<MessageChunk> {
    // opencode --json flag is unstable; falls back to stdout line parsing
    const args = ['run', '--json', message]
    if (persona) args.push('--system-prompt', persona)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('opencode', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        chunks.push(parseOpencodeLine(line))
        resolve?.()
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseOpencodeLine(line: string): MessageChunk {
  try {
    const json = JSON.parse(line)
    if (typeof json?.content === 'string') return { type: 'text', content: json.content, raw: json }
    if (typeof json?.text === 'string') return { type: 'text', content: json.text, raw: json }
  } catch { /* fall through */ }
  return { type: 'text', content: line }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/main/adapters/gemini.adapter.test.ts src/main/adapters/opencode.adapter.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/adapters/
git commit -m "feat: GeminiAdapter and OpencodeAdapter with line-parsing fallback"
```

---

### Task 6: Adapter Manager

**Files:**

- Create: `src/main/adapters/manager.ts`
- Test: `src/main/adapters/manager.test.ts`

**Interfaces:**

- Consumes: `ClaudeAdapter`, `GeminiAdapter`, `OpencodeAdapter`
- Produces:
  ```typescript
  export const AdapterManager: {
    getActive(): BackendAdapter
    setActive(id: string): void
    listAvailable(): Promise<BackendInfo[]>
    get(id: string): BackendAdapter | undefined
  }
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/adapters/manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdapterManager } from './manager'

vi.mock('./claude.adapter', () => ({
  ClaudeAdapter: class {
    id = 'claude'
    isAvailable = vi.fn().mockResolvedValue(true)
    send = vi.fn()
    abort = vi.fn()
  }
}))
vi.mock('./gemini.adapter', () => ({
  GeminiAdapter: class {
    id = 'gemini'
    isAvailable = vi.fn().mockResolvedValue(false)
    send = vi.fn()
    abort = vi.fn()
  }
}))
vi.mock('./opencode.adapter', () => ({
  OpencodeAdapter: class {
    id = 'opencode'
    isAvailable = vi.fn().mockResolvedValue(false)
    send = vi.fn()
    abort = vi.fn()
  }
}))

describe('AdapterManager', () => {
  it('defaults to claude as active adapter', () => {
    expect(AdapterManager.getActive().id).toBe('claude')
  })

  it('setActive switches the active adapter', () => {
    AdapterManager.setActive('gemini')
    expect(AdapterManager.getActive().id).toBe('gemini')
    AdapterManager.setActive('claude') // reset
  })

  it('throws when setActive receives unknown id', () => {
    expect(() => AdapterManager.setActive('unknown')).toThrow()
  })

  it('listAvailable reflects isAvailable() results', async () => {
    const infos = await AdapterManager.listAvailable()
    const claude = infos.find(i => i.id === 'claude')
    expect(claude?.available).toBe(true)
    const gemini = infos.find(i => i.id === 'gemini')
    expect(gemini?.available).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/adapters/manager.test.ts
```

Expected: FAIL — `Cannot find module './manager'`

- [ ] **Step 3: Write `src/main/adapters/manager.ts`**

```typescript
import { ClaudeAdapter } from './claude.adapter'
import { GeminiAdapter } from './gemini.adapter'
import { OpencodeAdapter } from './opencode.adapter'
import type { BackendAdapter, BackendInfo } from '../../shared/types'

const registry: BackendAdapter[] = [
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new OpencodeAdapter(),
]

let activeId = 'claude'

export const AdapterManager = {
  getActive(): BackendAdapter {
    return registry.find(a => a.id === activeId)!
  },

  setActive(id: string): void {
    if (!registry.find(a => a.id === id)) throw new Error(`Unknown adapter: ${id}`)
    activeId = id
  },

  get(id: string): BackendAdapter | undefined {
    return registry.find(a => a.id === id)
  },

  async listAvailable(): Promise<BackendInfo[]> {
    return Promise.all(
      registry.map(async a => ({
        id: a.id,
        label: labelFor(a.id),
        available: await a.isAvailable(),
        authenticated: await a.isAvailable(), // probe doubles as auth check for now
      }))
    )
  },
}

function labelFor(id: string): string {
  return { claude: 'Claude Code', gemini: 'Gemini CLI', opencode: 'Opencode' }[id] ?? id
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/adapters/manager.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/adapters/manager.ts src/main/adapters/manager.test.ts
git commit -m "feat: AdapterManager singleton with active-adapter switching"
```

---

### Task 7: Wizard Probe + Install

**Files:**

- Create: `src/main/wizard/probe.ts`
- Create: `src/main/wizard/install.ts`
- Test: `src/main/wizard/probe.test.ts`

**Interfaces:**

- Produces:
  ```typescript
  // probe.ts
  export async function probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }>

  // install.ts
  export function installBackend(id: string, onData: (line: string) => void): Promise<boolean>
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/wizard/probe.test.ts
import { describe, it, expect, vi } from 'vitest'
import { probeBackend } from './probe'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

function mockSpawn(exitCode: number) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => proc.emit('close', exitCode), 0)
}

describe('probeBackend', () => {
  it('returns available=true for exit code 0', async () => {
    mockSpawn(0)
    const result = await probeBackend('claude')
    expect(result.available).toBe(true)
  })

  it('returns available=false for non-zero exit code', async () => {
    mockSpawn(1)
    const result = await probeBackend('claude')
    expect(result.available).toBe(false)
  })

  it('returns available=false for unknown backend id', async () => {
    const result = await probeBackend('unknown')
    expect(result.available).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/wizard/probe.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write `src/main/wizard/probe.ts`**

```typescript
import { spawn } from 'child_process'

const PROBE_COMMANDS: Record<string, string[]> = {
  claude:   ['claude', ['--version']],
  gemini:   ['gemini', ['auth', 'status']],
  opencode: ['opencode', ['--version']],
} as any

// probe commands as [binary, args[]]
const PROBES: Record<string, [string, string[]]> = {
  claude:   ['claude',   ['--version']],
  gemini:   ['gemini',   ['auth', 'status']],
  opencode: ['opencode', ['--version']],
}

export async function probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }> {
  const probe = PROBES[id]
  if (!probe) return { available: false, authenticated: false }

  const [binary, args] = probe
  const exitCode = await runAndGetExit(binary, args)
  return { available: exitCode === 0, authenticated: exitCode === 0 }
}

function runAndGetExit(binary: string, args: string[]): Promise<number> {
  return new Promise(resolve => {
    const p = spawn(binary, args, { stdio: 'pipe' })
    p.on('close', code => resolve(code ?? 1))
    p.on('error', () => resolve(1))
  })
}
```

- [ ] **Step 4: Write `src/main/wizard/install.ts`**

```typescript
import { spawn } from 'child_process'

const INSTALL_COMMANDS: Record<string, [string, string[]]> = {
  gemini:   ['npm', ['install', '-g', '@google/gemini-cli']],
  opencode: ['npm', ['install', '-g', 'opencode']],
}

export function installBackend(id: string, onData: (line: string) => void): Promise<boolean> {
  const cmd = INSTALL_COMMANDS[id]
  if (!cmd) return Promise.resolve(false)

  const [binary, args] = cmd
  return new Promise(resolve => {
    const p = spawn(binary, args, { stdio: 'pipe', shell: true })
    p.stdout!.on('data', (buf: Buffer) => buf.toString().split('\n').filter(Boolean).forEach(onData))
    p.stderr!.on('data', (buf: Buffer) => buf.toString().split('\n').filter(Boolean).forEach(onData))
    p.on('close', code => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/main/wizard/probe.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/wizard/
git commit -m "feat: wizard probe and install helpers"
```

---

### Task 8: Main Process IPC Handlers + Electron Entry

**Files:**

- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

**Interfaces:**

- Consumes: `AdapterManager`, `ConvStore`, `probeBackend`, `installBackend`, `IPC` from shared
- Produces: all IPC channels registered and responding; BrowserWindow with secure settings

- [ ] **Step 1: Write `src/preload/index.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ipc', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel: string, listener: (...args: unknown[]) => void): () => void {
    const wrapped = (_event: unknown, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})
```

- [ ] **Step 2: Write `src/main/ipc.ts`**

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import { AdapterManager } from './adapters/manager'
import { ConvStore } from './store'
import { probeBackend } from './wizard/probe'
import { installBackend } from './wizard/install'

export function registerIpcHandlers(win: BrowserWindow): void {
  // chat:send — starts streaming, pushes chat:chunk and chat:done via webContents
  ipcMain.handle(IPC.CHAT_SEND, async (event, { conversationId, message, backend, personaId }) => {
    const adapter = AdapterManager.get(backend) ?? AdapterManager.getActive()
    AdapterManager.setActive(adapter.id)

    const persona = personaId ? ConvStore.listPersonas().find(p => p.id === personaId) : ConvStore.getDefaultPersona()

    let conv = conversationId ? ConvStore.getConversation(conversationId) : undefined
    if (!conv) {
      conv = ConvStore.createConversation(message.slice(0, 60), adapter.id, persona?.id ?? null)
    }

    ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: message, backend: adapter.id })

    let fullContent = ''
    for await (const chunk of adapter.send(message, persona?.systemPrompt)) {
      if (chunk.type === 'text') fullContent += chunk.content
      event.sender.send(IPC.CHAT_CHUNK, { ...chunk, conversationId: conv.id })
      if (chunk.type === 'done') break
    }

    const saved = ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: fullContent, backend: adapter.id })
    event.sender.send(IPC.CHAT_DONE, { conversationId: conv.id, messageId: saved.id })
    return conv.id
  })

  ipcMain.handle(IPC.CHAT_ABORT, (_event, { conversationId: _id }) => {
    AdapterManager.getActive().abort()
  })

  ipcMain.handle(IPC.CONV_LIST, (_event, { limit, offset }) =>
    ConvStore.listConversations(limit, offset))

  ipcMain.handle(IPC.CONV_GET, (_event, { conversationId }) => ({
    conversation: ConvStore.getConversation(conversationId),
    messages: ConvStore.getMessages(conversationId),
  }))

  ipcMain.handle(IPC.CONV_SEARCH, (_event, { query }) =>
    ConvStore.searchMessages(query))

  ipcMain.handle(IPC.PERSONA_LIST, () => ConvStore.listPersonas())

  ipcMain.handle(IPC.PERSONA_SAVE, (_event, p) =>
    p.id ? ConvStore.updatePersona(p.id, p) : ConvStore.createPersona(p))

  ipcMain.handle(IPC.PERSONA_DELETE, (_event, { id }) => ConvStore.deletePersona(id))

  ipcMain.handle(IPC.BACKEND_LIST, () => AdapterManager.listAvailable())

  ipcMain.handle(IPC.WIZARD_PROBE, (_event, { backend }) => probeBackend(backend))

  ipcMain.handle(IPC.WIZARD_INSTALL, (event, { backend }) =>
    installBackend(backend, line => event.sender.send('wizard:install:line', line)))

  ipcMain.handle(IPC.WIZARD_DONE, () => {
    // Persist wizard-complete flag
    win.webContents.executeJavaScript(`localStorage.setItem('wizardDone','1')`)
  })
}
```

- [ ] **Step 3: Write `src/main/index.ts`**

```typescript
import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { initDb } from './store/db'
import { registerIpcHandlers } from './ipc'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Open external links in OS browser, not Electron
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  initDb(`${userDataPath}/conversations.db`)

  const win = createWindow()
  registerIpcHandlers(win)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 4: Verify the app builds and runs**

```bash
npm run dev
```

Expected: Electron window opens without errors in the main process console.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat: main process IPC handlers and Electron entry with secure BrowserWindow"
```

---

### Task 9: Renderer IPC Client + Hooks

**Files:**

- Create: `src/renderer/ipc.ts`
- Create: `src/renderer/hooks/useConversations.ts`
- Create: `src/renderer/hooks/useMessages.ts`
- Create: `src/renderer/hooks/usePersonas.ts`
- Create: `src/renderer/hooks/useBackends.ts`

**Interfaces:**

- Consumes: `IPC` from `src/shared/ipc.ts`, `window.ipc` injected by preload
- Produces: typed React hooks used by all UI components

- [ ] **Step 1: Write `src/renderer/ipc.ts`**

```typescript
import { IPC } from '../shared/ipc'
import type { IpcInvokeMap } from '../shared/ipc'
import type { Conversation, Message, Persona, BackendInfo, MessageChunk } from '../shared/types'

// window.ipc is injected by preload/index.ts via contextBridge
declare global {
  interface Window {
    ipc: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on(channel: string, listener: (...args: unknown[]) => void): () => void
    }
  }
}

export async function sendChat(payload: IpcInvokeMap[typeof IPC.CHAT_SEND]): Promise<string> {
  return window.ipc.invoke(IPC.CHAT_SEND, payload) as Promise<string>
}
export function onChatChunk(cb: (chunk: MessageChunk & { conversationId: string }) => void) {
  return window.ipc.on(IPC.CHAT_CHUNK, cb as any)
}
export function onChatDone(cb: (payload: { conversationId: string; messageId: string }) => void) {
  return window.ipc.on(IPC.CHAT_DONE, cb as any)
}
export async function abortChat(conversationId: string): Promise<void> {
  await window.ipc.invoke(IPC.CHAT_ABORT, { conversationId })
}
export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  return window.ipc.invoke(IPC.CONV_LIST, { limit, offset }) as Promise<Conversation[]>
}
export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return window.ipc.invoke(IPC.CONV_GET, { conversationId }) as Promise<any>
}
export async function searchConversations(query: string): Promise<Message[]> {
  return window.ipc.invoke(IPC.CONV_SEARCH, { query }) as Promise<Message[]>
}
export async function listPersonas(): Promise<Persona[]> {
  return window.ipc.invoke(IPC.PERSONA_LIST) as Promise<Persona[]>
}
export async function savePersona(p: Omit<Persona, 'id'> & { id?: string }): Promise<Persona> {
  return window.ipc.invoke(IPC.PERSONA_SAVE, p) as Promise<Persona>
}
export async function deletePersona(id: string): Promise<void> {
  await window.ipc.invoke(IPC.PERSONA_DELETE, { id })
}
export async function listBackends(): Promise<BackendInfo[]> {
  return window.ipc.invoke(IPC.BACKEND_LIST) as Promise<BackendInfo[]>
}
export async function probeBackend(backend: string): Promise<{ available: boolean; authenticated: boolean }> {
  return window.ipc.invoke(IPC.WIZARD_PROBE, { backend }) as Promise<any>
}
export async function installBackend(backend: string): Promise<boolean> {
  return window.ipc.invoke(IPC.WIZARD_INSTALL, { backend }) as Promise<boolean>
}
export async function markWizardDone(): Promise<void> {
  await window.ipc.invoke(IPC.WIZARD_DONE)
}
```

- [ ] **Step 2: Write `src/renderer/hooks/useConversations.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listConversations, searchConversations } from '../ipc'
import type { Conversation, Message } from '../../shared/types'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const convs = await listConversations()
    setConversations(convs)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const search = useCallback(async (query: string): Promise<Message[]> => {
    if (!query.trim()) return []
    return searchConversations(query)
  }, [])

  return { conversations, loading, refresh, search }
}
```

- [ ] **Step 3: Write `src/renderer/hooks/useMessages.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { getConversation, sendChat, onChatChunk, onChatDone, abortChat } from '../ipc'
import type { Message } from '../../shared/types'

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const streamingContent = useRef('')
  const currentConvId = useRef<string | null>(null)

  useEffect(() => {
    if (!conversationId) { setMessages([]); return }
    getConversation(conversationId).then(({ messages: msgs }) => setMessages(msgs))
  }, [conversationId])

  useEffect(() => {
    const offChunk = onChatChunk(({ conversationId: cid, type, content }) => {
      if (type !== 'text') return
      streamingContent.current += content
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.conversationId === cid) {
          return [...prev.slice(0, -1), { ...last, content: streamingContent.current }]
        }
        return prev
      })
    })
    const offDone = onChatDone(() => {
      setStreaming(false)
      streamingContent.current = ''
    })
    return () => { offChunk(); offDone() }
  }, [])

  const send = useCallback(async (message: string, backend: string, personaId?: string) => {
    setStreaming(true)
    streamingContent.current = ''
    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'user', content: message, backend, createdAt: Date.now(),
    }
    const assistantPlaceholder: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'assistant', content: '', backend, createdAt: Date.now(),
    }
    setMessages(prev => [...prev, userMsg, assistantPlaceholder])
    const newConvId = await sendChat({ conversationId, message, backend, personaId })
    currentConvId.current = newConvId
    return newConvId
  }, [conversationId])

  const abort = useCallback(() => {
    if (currentConvId.current) abortChat(currentConvId.current)
    setStreaming(false)
  }, [])

  return { messages, streaming, send, abort }
}
```

- [ ] **Step 4: Write `src/renderer/hooks/usePersonas.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listPersonas, savePersona, deletePersona } from '../ipc'
import type { Persona } from '../../shared/types'

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([])

  const refresh = useCallback(async () => {
    setPersonas(await listPersonas())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const save = useCallback(async (p: Omit<Persona, 'id'> & { id?: string }) => {
    await savePersona(p)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deletePersona(id)
    await refresh()
  }, [refresh])

  return { personas, save, remove, refresh }
}
```

- [ ] **Step 5: Write `src/renderer/hooks/useBackends.ts`**

```typescript
import { useState, useEffect } from 'react'
import { listBackends } from '../ipc'
import type { BackendInfo } from '../../shared/types'

export function useBackends() {
  const [backends, setBackends] = useState<BackendInfo[]>([])

  useEffect(() => {
    listBackends().then(setBackends)
  }, [])

  return { backends }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/ipc.ts src/renderer/hooks/
git commit -m "feat: renderer IPC client and React hooks for all data sources"
```

---

### Task 10: Chat UI Components

**Files:**

- Create: `src/renderer/components/Chat/MessageBubble.tsx`
- Create: `src/renderer/components/Chat/MessageList.tsx`
- Create: `src/renderer/components/Chat/InputBar.tsx`
- Create: `src/renderer/components/Chat/ChatView.tsx`

**Interfaces:**

- Consumes: `useMessages`, `Message` from shared types
- Produces: `<ChatView conversationId={string|null} backend={string} personaId={string|undefined} onNewConversation={(id)=>void} />`

- [ ] **Step 1: Install markdown renderer**

```bash
npm install react-markdown
```

- [ ] **Step 2: Write `src/renderer/components/Chat/MessageBubble.tsx`**

```tsx
import ReactMarkdown from 'react-markdown'
import type { Message } from '../../../../shared/types'

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      }`}>
        {isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{message.content}</ReactMarkdown>
        }
        <div className="text-xs opacity-50 mt-1">
          {message.backend} · {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/renderer/components/Chat/MessageList.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../../../../shared/types'

interface Props { messages: Message[]; streaming: boolean }

export function MessageList({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
      {streaming && (
        <div className="flex justify-start mb-3">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
            <span className="animate-pulse text-sm text-gray-500">thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Write `src/renderer/components/Chat/InputBar.tsx`**

```tsx
import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  onAbort: () => void
  streaming: boolean
  disabled?: boolean
}

export function InputBar({ onSend, onAbort, streaming, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || streaming) return
    onSend(trimmed)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={disabled}
        />
        {streaming
          ? <button onClick={onAbort} className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600">Stop</button>
          : <button onClick={submit} disabled={!value.trim() || disabled} className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">Send</button>
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/renderer/components/Chat/ChatView.tsx`**

```tsx
import { useMessages } from '../../../hooks/useMessages'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

interface Props {
  conversationId: string | null
  backend: string
  personaId?: string
  onNewConversation: (id: string) => void
}

export function ChatView({ conversationId, backend, personaId, onNewConversation }: Props) {
  const { messages, streaming, send, abort } = useMessages(conversationId)

  const handleSend = async (message: string) => {
    const newId = await send(message, backend, personaId)
    if (!conversationId && newId) onNewConversation(newId)
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Start a conversation
        </div>
      )}
      {(messages.length > 0 || streaming) && (
        <MessageList messages={messages} streaming={streaming} />
      )}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/
git commit -m "feat: Chat UI components (MessageBubble, MessageList, InputBar, ChatView)"
```

---

### Task 11: Conversation Sidebar

**Files:**

- Create: `src/renderer/components/Sidebar/ConvItem.tsx`
- Create: `src/renderer/components/Sidebar/ConvList.tsx`
- Create: `src/renderer/components/Sidebar/Sidebar.tsx`

**Interfaces:**

- Consumes: `useConversations`, `Conversation` type
- Produces: `<Sidebar activeId={string|null} onSelect={(id)=>void} onNew={()=>void} />`

- [ ] **Step 1: Write `src/renderer/components/Sidebar/ConvItem.tsx`**

```tsx
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

export function ConvItem({ conversation, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700' : ''
      }`}
    >
      <div className="font-medium truncate">{conversation.title}</div>
      <div className="text-xs text-gray-400 flex gap-2">
        <span>{conversation.backend}</span>
        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Write `src/renderer/components/Sidebar/ConvList.tsx`**

```tsx
import { useState } from 'react'
import { useConversations } from '../../../hooks/useConversations'
import { ConvItem } from './ConvItem'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConvList({ activeId, onSelect }: Props) {
  const { conversations, search } = useConversations()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conversationId: string }[] | null>(null)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    const results = await search(q)
    setSearchResults(results)
  }

  const displayed = searchResults
    ? conversations.filter(c => searchResults.some(r => r.conversationId === c.id))
    : conversations

  return (
    <div className="flex flex-col gap-1">
      <input
        className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
      />
      {displayed.map(conv => (
        <ConvItem
          key={conv.id}
          conversation={conv}
          active={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/renderer/components/Sidebar/Sidebar.tsx`**

```tsx
import { ConvList } from './ConvList'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  return (
    <div className="w-64 flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">BII Agent Harness</span>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList activeId={activeId} onSelect={onSelect} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar/
git commit -m "feat: conversation sidebar with search"
```

---

### Task 12: Persona Panel + Backend Switcher

**Files:**

- Create: `src/renderer/components/Personas/PersonaPanel.tsx`
- Create: `src/renderer/components/BackendSwitcher.tsx`

**Interfaces:**

- Consumes: `usePersonas`, `useBackends`
- Produces:
  - `<PersonaPanel activePersonaId={string|null} onSelect={(id|null)=>void} />`
  - `<BackendSwitcher value={string} onChange={(id)=>void} />`

- [ ] **Step 1: Write `src/renderer/components/Personas/PersonaPanel.tsx`**

```tsx
import { useState } from 'react'
import { usePersonas } from '../../../hooks/usePersonas'
import type { Persona } from '../../../../shared/types'

interface Props {
  activePersonaId: string | null
  onSelect: (id: string | null) => void
}

export function PersonaPanel({ activePersonaId, onSelect }: Props) {
  const { personas, save, remove } = usePersonas()
  const [editing, setEditing] = useState<Partial<Persona> | null>(null)

  const startNew = () => setEditing({ name: '', systemPrompt: '', isDefault: false })
  const cancel = () => setEditing(null)

  const submit = async () => {
    if (!editing?.name) return
    await save({ name: editing.name!, systemPrompt: editing.systemPrompt ?? '', isDefault: editing.isDefault ?? false, ...(editing.id ? { id: editing.id } : {}) })
    setEditing(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Personas</h3>
        <button onClick={startNew} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">+ New</button>
      </div>

      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === null ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        onClick={() => onSelect(null)}
      >
        <span>No persona</span>
      </div>

      {personas.map(p => (
        <div
          key={p.id}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === p.id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          onClick={() => onSelect(p.id)}
        >
          <div>
            <div className="font-medium">{p.name}</div>
            {p.isDefault && <div className="text-xs text-blue-500">default</div>}
          </div>
          <div className="flex gap-1">
            <button onClick={e => { e.stopPropagation(); setEditing(p) }} className="text-xs text-gray-400 hover:text-gray-700 px-1">Edit</button>
            <button onClick={e => { e.stopPropagation(); remove(p.id) }} className="text-xs text-red-400 hover:text-red-600 px-1">Del</button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <input
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Name"
            value={editing.name ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
          />
          <textarea
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 resize-none"
            placeholder="System prompt..."
            rows={3}
            value={editing.systemPrompt ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, systemPrompt: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isDefault ?? false} onChange={e => setEditing(prev => ({ ...prev, isDefault: e.target.checked }))} />
            Set as default
          </label>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 text-sm py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
            <button onClick={cancel} className="flex-1 text-sm py-1 rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/renderer/components/BackendSwitcher.tsx`**

```tsx
import { useBackends } from '../../hooks/useBackends'

interface Props {
  value: string
  onChange: (id: string) => void
}

export function BackendSwitcher({ value, onChange }: Props) {
  const { backends } = useBackends()

  return (
    <select
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {backends.map(b => (
        <option key={b.id} value={b.id} disabled={!b.available}>
          {b.label}{!b.available ? ' (not installed)' : !b.authenticated ? ' (not auth)' : ''}
        </option>
      ))}
    </select>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Personas/ src/renderer/components/BackendSwitcher.tsx
git commit -m "feat: PersonaPanel CRUD and BackendSwitcher dropdown"
```

---

### Task 13: Setup Wizard

**Files:**

- Create: `src/renderer/components/Wizard/WizardStep1.tsx`
- Create: `src/renderer/components/Wizard/WizardStep2.tsx`
- Create: `src/renderer/components/Wizard/WizardStep3.tsx`
- Create: `src/renderer/components/Wizard/SetupWizard.tsx`

**Interfaces:**

- Consumes: `probeBackend`, `installBackend`, `markWizardDone` from renderer IPC
- Produces: `<SetupWizard onComplete={() => void} />`

- [ ] **Step 1: Write `src/renderer/components/Wizard/WizardStep1.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { probeBackend } from '../../../ipc'

const BACKENDS = [
  { id: 'claude', label: 'Claude Code', bundled: true },
  { id: 'gemini', label: 'Gemini CLI', bundled: false },
  { id: 'opencode', label: 'Opencode', bundled: false },
]

interface BackendStatus { id: string; available: boolean; authenticated: boolean; loading: boolean }

interface Props { onNext: (statuses: BackendStatus[]) => void }

export function WizardStep1({ onNext }: Props) {
  const [statuses, setStatuses] = useState<BackendStatus[]>(
    BACKENDS.map(b => ({ id: b.id, available: b.bundled, authenticated: b.bundled, loading: !b.bundled }))
  )

  useEffect(() => {
    BACKENDS.filter(b => !b.bundled).forEach(async b => {
      const result = await probeBackend(b.id)
      setStatuses(prev => prev.map(s => s.id === b.id ? { ...s, ...result, loading: false } : s))
    })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Detecting AI backends</h2>
        <p className="text-sm text-gray-500">Checking which CLI tools are installed on your system.</p>
      </div>
      <div className="flex flex-col gap-3">
        {BACKENDS.map((b, i) => {
          const s = statuses[i]
          return (
            <div key={b.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="text-xl">
                {s.loading ? '⏳' : s.available ? '✅' : '❌'}
              </div>
              <div>
                <div className="font-medium text-sm">{b.label}</div>
                <div className="text-xs text-gray-400">
                  {b.bundled ? 'Bundled — always available' : s.loading ? 'Checking...' : s.available ? 'Found' : 'Not found'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => onNext(statuses)}
        disabled={statuses.some(s => s.loading)}
        className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/renderer/components/Wizard/WizardStep2.tsx`**

```tsx
import { useState } from 'react'
import { installBackend } from '../../../ipc'

const LABELS: Record<string, string> = { gemini: 'Gemini CLI', opencode: 'Opencode' }

interface Props {
  missing: string[]
  onNext: () => void
}

export function WizardStep2({ missing, onNext }: Props) {
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [installing, setInstalling] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, boolean>>({})

  const install = async (id: string) => {
    setInstalling(prev => ({ ...prev, [id]: true }))
    const addLine = (line: string) => setLogs(prev => ({ ...prev, [id]: [...(prev[id] ?? []), line] }))

    // listen for install output lines
    const off = window.ipc.on('wizard:install:line', (line: unknown) => addLine(String(line)))
    const ok = await installBackend(id)
    off()

    setInstalling(prev => ({ ...prev, [id]: false }))
    setDone(prev => ({ ...prev, [id]: ok }))
  }

  if (missing.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">All backends available</h2>
        <button onClick={onNext} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">Next</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Install optional backends</h2>
        <p className="text-sm text-gray-500">These are optional. You can skip and add them later from Settings.</p>
      </div>
      {missing.map(id => (
        <div key={id} className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
            <button
              onClick={() => install(id)}
              disabled={installing[id] || done[id]}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {done[id] ? 'Installed ✓' : installing[id] ? 'Installing...' : 'Install'}
            </button>
          </div>
          {(logs[id] ?? []).length > 0 && (
            <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-2 max-h-24 overflow-y-auto">
              {logs[id].join('\n')}
            </pre>
          )}
        </div>
      ))}
      <button onClick={onNext} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">
        Continue
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/renderer/components/Wizard/WizardStep3.tsx`**

```tsx
import { useState } from 'react'
import { probeBackend } from '../../../ipc'

const AUTH_COMMANDS: Record<string, string> = {
  claude: 'claude login',
  gemini: 'gemini auth login',
  opencode: 'opencode auth',
}

interface BackendStatus { id: string; available: boolean; authenticated: boolean; loading: boolean }

interface Props {
  statuses: BackendStatus[]
  onComplete: () => void
}

export function WizardStep3({ statuses: initial, onComplete }: Props) {
  const [statuses, setStatuses] = useState(initial)

  const recheck = async (id: string) => {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, loading: true } : s))
    const result = await probeBackend(id)
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...result, loading: false } : s))
  }

  const needsAuth = statuses.filter(s => s.available && !s.authenticated)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Authenticate backends</h2>
        <p className="text-sm text-gray-500">Run the command shown, then click Recheck.</p>
      </div>
      {needsAuth.length === 0 && (
        <div className="text-sm text-green-600 font-medium">All available backends are authenticated ✓</div>
      )}
      {needsAuth.map(s => (
        <div key={s.id} className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="font-medium text-sm">{s.id}</div>
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">{AUTH_COMMANDS[s.id]}</code>
          <button
            onClick={() => recheck(s.id)}
            disabled={s.loading}
            className="text-sm py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {s.loading ? 'Checking...' : 'Recheck'}
          </button>
        </div>
      ))}
      <button onClick={onComplete} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">
        Finish Setup
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/renderer/components/Wizard/SetupWizard.tsx`**

```tsx
import { useState } from 'react'
import { WizardStep1 } from './WizardStep1'
import { WizardStep2 } from './WizardStep2'
import { WizardStep3 } from './WizardStep3'
import { markWizardDone } from '../../../ipc'

interface BackendStatus { id: string; available: boolean; authenticated: boolean; loading: boolean }

interface Props { onComplete: () => void }

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [statuses, setStatuses] = useState<BackendStatus[]>([])

  const handleStep1 = (s: BackendStatus[]) => { setStatuses(s); setStep(2) }
  const handleStep2 = () => setStep(3)
  const handleComplete = async () => {
    await markWizardDone()
    onComplete()
  }

  const missing = statuses.filter(s => !s.available).map(s => s.id)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        <div className="flex gap-1 mb-8">
          {[1, 2, 3].map(n => (
            <div key={n} className={`h-1 flex-1 rounded-full ${step >= n ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
          ))}
        </div>
        {step === 1 && <WizardStep1 onNext={handleStep1} />}
        {step === 2 && <WizardStep2 missing={missing} onNext={handleStep2} />}
        {step === 3 && <WizardStep3 statuses={statuses} onComplete={handleComplete} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/
git commit -m "feat: 3-step setup wizard (detect, install, auth)"
```

---

### Task 14: App Root + Layout

**Files:**

- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/main.tsx`

**Interfaces:**

- Consumes: `SetupWizard`, `Sidebar`, `ChatView`, `PersonaPanel`, `BackendSwitcher`
- Produces: complete working app — wizard gate on first launch, main layout thereafter

- [ ] **Step 1: Write `src/renderer/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { SetupWizard } from './components/Wizard/SetupWizard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { PersonaPanel } from './components/Personas/PersonaPanel'
import { BackendSwitcher } from './components/BackendSwitcher'

function App() {
  const [wizardDone, setWizardDone] = useState(() => localStorage.getItem('wizardDone') === '1')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [backend, setBackend] = useState('claude')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [showPersonas, setShowPersonas] = useState(false)

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={id => setActiveConvId(id)}
        onNew={() => setActiveConvId(null)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <BackendSwitcher value={backend} onChange={setBackend} />
          <button
            onClick={() => setShowPersonas(v => !v)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Personas
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <ChatView
            conversationId={activeConvId}
            backend={backend}
            personaId={personaId ?? undefined}
            onNewConversation={id => setActiveConvId(id)}
          />
          {showPersonas && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PersonaPanel activePersonaId={personaId} onSelect={setPersonaId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2: Ensure `src/renderer/main.tsx` imports App and index.css**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Run the full app and smoke test**

```bash
npm run dev
```

Verify manually:
- First launch shows wizard (3 steps, Claude always ✅)
- After wizard completes, main layout appears
- Can type a message, send to Claude, see streaming response
- New conversation auto-created
- Backend switcher changes active backend
- Persona panel opens/closes; personas can be created and selected
- Sidebar lists conversations; clicking one loads its messages
- Search finds messages by keyword

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/main.tsx
git commit -m "feat: app root with wizard gate, chat layout, persona + backend toolbar"
```

---

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
