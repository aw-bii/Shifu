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

