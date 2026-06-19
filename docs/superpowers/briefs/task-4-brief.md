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

