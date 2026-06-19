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

