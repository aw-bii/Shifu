# Task 3 Brief: Database Layer

## Global Constraints

- `crypto.randomUUID()` for all ID generation (Node 14.17+ built-in) — no uuid package.
- SQLite migrations in `src/main/store/migrations/` numbered `001_`, `002_`, applied in order.
- TypeScript strict mode on.

## Context from Earlier Tasks

- `Conversation`, `Message`, `Persona` interfaces are defined in `src/shared/types.ts`
- `better-sqlite3` was installed with `--ignore-scripts` (native module not compiled yet). Before running tests, you must compile it: `npm rebuild better-sqlite3` or `npx node-pre-gyp install --directory node_modules/better-sqlite3`. If node-gyp is not available, try `npm install --build-from-source better-sqlite3`.

## Task 3: Database Layer

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
