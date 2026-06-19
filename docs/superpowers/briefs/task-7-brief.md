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

