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

