# P0 Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three P0 features blocking the core value prop: keyboard shortcuts, a settings panel with wizard re-entry, and bundling Claude Code in the installer.

**Architecture:** Keyboard shortcuts are a renderer-only concern (global `keydown` listeners in `App.tsx`). Settings panel adds a new React component + IPC channels + a `settings` table in SQLite. Claude bundling is purely a build/packaging concern – it downloads the Claude binary at build time and embeds it via `electron-builder` `extraResources`, with a fallback in the adapter to use PATH if bundled binary is absent.

**Tech Stack:** Electron, React 18, Tailwind CSS, TypeScript, electron-builder, better-sqlite3

---

### Task 1: Keyboard Shortcuts

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Sidebar/ConvList.tsx:28-33`

- [ ] **Step 1: Add keyboard shortcut handler to App.tsx**

Add a `useEffect` with global `keydown` listener. The three shortcuts:
- `Ctrl/Cmd+N` → new conversation (calls `handleNew`)
- `Ctrl/Cmd+F` → focus the search input in the sidebar
- `Ctrl/Cmd+Enter` → send message (needs to bubble through to `InputBar`)

Insert after the `useEffect` that loads conversation metadata (line 28):

```typescript
import { useCallback, useEffect, useRef } from 'react' // already imported

// Add after line 28 (the metadata loading effect):
const searchInputRef = useRef<HTMLInputElement | null>(null)
const setSearchInputRef = useCallback((el: HTMLInputElement | null) => {
  searchInputRef.current = el
}, [])

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key === 'n') {
      e.preventDefault()
      handleNew()
    }
    if (mod && e.key === 'f') {
      e.preventDefault()
      searchInputRef.current?.focus()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [handleNew])
```

- [ ] **Step 2: Pass searchInputRef through Sidebar → ConvList**

Modify `Sidebar.tsx` to accept and forward a `searchInputRef` prop to `ConvList`:

```typescript
// In Sidebar.tsx, add `searchInputRef` to Props and pass it to ConvList
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

// In the ConvList usage inside Sidebar.tsx:
// <ConvList activeId={activeId} onSelect={onSelect} searchInputRef={searchInputRef} />
```

Modify `ConvList.tsx` to use the forwarded ref:

```typescript
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

// Add ref to the search input:
<input
  ref={(el: HTMLInputElement | null) => {
    if (props.searchInputRef) props.searchInputRef.current = el
  }}
  // ... existing props
/>
```

- [ ] **Step 3: Add Ctrl/Cmd+Enter to InputBar**

In `InputBar.tsx`, modify the `onKeyDown` handler to also accept `Ctrl/Cmd+Enter`:

```typescript
const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
}
```

- [ ] **Step 4: Run build to verify no TS errors**

Run: `npm run build`
Expected: Success, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/Sidebar/Sidebar.tsx src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Chat/InputBar.tsx
git commit -m "feat: add keyboard shortcuts (Ctrl+N, Ctrl+F, Ctrl+Enter)"
```

---

### Task 2: Settings Panel + Wizard Re-entry

**Files:**
- Create: `src/renderer/components/Settings/SettingsPanel.tsx`
- Create: `src/main/store/migrations/005_settings.sql`
- Modify: `src/main/store/db.ts:30` (add migration import)
- Modify: `src/main/store/index.ts` (add `ConvStore` settings methods)
- Modify: `src/main/ipc.ts` (add settings IPC handlers)
- Modify: `src/shared/ipc.ts` (add settings IPC channels)
- Modify: `src/preload/index.ts` (add new channels to ALLOWED_CHANNELS)
- Modify: `src/renderer/App.tsx` (add settings button + panel toggle)
- Modify: `src/renderer/ipc.ts` (add settings IPC wrappers)

- [ ] **Step 1: Create settings migration 005**

Create `src/main/store/migrations/005_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('wizard_done', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'system');
```

- [ ] **Step 2: Add settings CRUD to ConvStore**

Add to `src/main/store/index.ts`:

```typescript
getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  return row?.value
},

setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
},

getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as any[]
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key] = r.value
  return result
},
```

- [ ] **Step 3: Add IPC channels to src/shared/ipc.ts**

Add to the `IPC` const:

```typescript
SETTING_GET:   'setting:get',
SETTING_SET:   'setting:set',
SETTING_GET_ALL: 'setting:get-all',
```

Add to `IpcInvokeMap`:

```typescript
[IPC.SETTING_GET]:   { key: string }
[IPC.SETTING_SET]:   { key: string; value: string }
[IPC.SETTING_GET_ALL]: void
```

- [ ] **Step 4: Add IPC handlers in src/main/ipc.ts**

Add handlers:

```typescript
import { ConvStore } from './store'

// Add after the WIZARD_DONE handler (line 87):
ipcMain.handle(IPC.SETTING_GET, (_event, { key }) => ConvStore.getSetting(key))
ipcMain.handle(IPC.SETTING_SET, (_event, { key, value }) => ConvStore.setSetting(key, value))
ipcMain.handle(IPC.SETTING_GET_ALL, () => ConvStore.getAllSettings())
```

- [ ] **Step 5: Add new channels to preload whitelist**

```typescript
// Already a Set from Object.values(IPC), so adding them to IPC const is sufficient.
// The IPC.WIZARD_DONE handler should now also persist to DB:
ipcMain.handle(IPC.WIZARD_DONE, () => {
  // renderer handles its own localStorage
  ConvStore.setSetting('wizard_done', '1')
})
```

- [ ] **Step 6: Add renderer IPC wrappers in src/renderer/ipc.ts**

```typescript
export async function getSetting(key: string): Promise<string | undefined> {
  return window.ipc.invoke(IPC.SETTING_GET, { key }) as Promise<string | undefined>
}
export async function setSetting(key: string, value: string): Promise<void> {
  await window.ipc.invoke(IPC.SETTING_SET, { key, value })
}
export async function getAllSettings(): Promise<Record<string, string>> {
  return window.ipc.invoke(IPC.SETTING_GET_ALL) as Promise<Record<string, string>>
}
```

- [ ] **Step 7: Create SettingsPanel component**

Create `src/renderer/components/Settings/SettingsPanel.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { getSetting, setSetting } from '../../ipc'

interface Props {
  onClose: () => void
  onReRunWizard: () => void
}

export function SettingsPanel({ onClose, onReRunWizard }: Props) {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [version] = useState('0.1.0')

  useEffect(() => {
    getSetting('theme').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setTheme(v)
    })
  }, [])

  const handleThemeChange = async (t: 'system' | 'light' | 'dark') => {
    setTheme(t)
    await setSetting('theme', t)
    // Apply theme immediately
    if (t === 'dark') document.documentElement.classList.add('dark')
    else if (t === 'light') document.documentElement.classList.remove('dark')
    else {
      // system: follow OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">Settings</span>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Close
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Theme</label>
          <select
            className="w-full text-xs border rounded px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600"
            value={theme}
            onChange={e => handleThemeChange(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <button
            onClick={onReRunWizard}
            className="text-xs w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          Version {version}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Wire settings panel into App.tsx**

Add a settings toggle state + gear button + conditional rendering of SettingsPanel.

Add state near line 20:
```typescript
const [showSettings, setShowSettings] = useState(false)
```

Add gear button in the toolbar (after the Pipelines button, line 105):
```typescript
<button
  onClick={() => setShowSettings(v => !v)}
  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
  aria-label="Settings"
>
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
</button>
```

Add SettingsPanel in the right panel area (after the Pipelines conditional, line 128):
```typescript
{showSettings && (
  <SettingsPanel
    onClose={() => setShowSettings(false)}
    onReRunWizard={() => {
      localStorage.removeItem('wizardDone')
      setWizardDone(false)
    }}
  />
)}
```

Import at top:
```typescript
import { SettingsPanel } from './components/Settings/SettingsPanel'
```

- [ ] **Step 9: Run build to verify no errors**

Run: `npm run build`
Expected: Success.

- [ ] **Step 10: Commit**

```bash
git add src/main/store/migrations/005_settings.sql src/main/store/index.ts src/main/ipc.ts src/shared/ipc.ts src/preload/index.ts src/renderer/ipc.ts src/renderer/App.tsx src/renderer/components/Settings/SettingsPanel.tsx
git commit -m "feat: add settings panel with theme toggle and wizard re-entry"
```

---

### Task 3: Claude Code Bundling

**Files:**
- Create: `scripts/download-claude.mjs`
- Modify: `electron-builder.config.ts`
- Modify: `src/main/adapters/claude.adapter.ts`

- [ ] **Step 1: Create download script**

Create `scripts/download-claude.mjs`:

```javascript
// Downloads Claude CLI binary for the current platform and places it in resources/
import { execSync } from 'child_process'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { homedir, platform } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources', 'claude-bin')

const PLATFORM_MAP = {
  win32: { npm: 'npm', ext: '.cmd' },
  darwin: { npm: 'npm', ext: '' },
  linux: { npm: 'npm', ext: '' },
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

async function main() {
  const plat = PLATFORM_RESOLVE[platform()]
  if (!plat) {
    console.error(`Unsupported platform: ${platform()}`)
    process.exit(1)
  }

  ensureDir(resourcesDir)

  // Find the globally installed claude binary location
  const whichCmd = platform() === 'win32' ? 'where claude' : 'which claude'
  try {
    const claudePath = execSync(whichCmd, { encoding: 'utf8' }).trim().split('\n')[0]
    console.log(`Found Claude at: ${claudePath}`)
    // Copy to resources
    const dest = join(resourcesDir, platform() === 'win32' ? 'claude.exe' : 'claude')
    copyFileSync(claudePath, dest)
    // On non-Windows, make executable
    if (platform() !== 'win32') {
      execSync(`chmod +x "${dest}"`)
    }
    console.log(`Claude binary bundled to: ${dest}`)
  } catch {
    // Claude not installed globally — download from npm
    console.log('Claude not found globally, installing to temp...')
    const tmpDir = join(resourcesDir, '..', '.claude-tmp')
    ensureDir(tmpDir)
    execSync(`npm init -y`, { cwd: tmpDir, stdio: 'pipe' })
    execSync(`npm install @anthropic-ai/claude-code`, { cwd: tmpDir, stdio: 'pipe' })
    // Find the installed binary
    const binaryName = platform() === 'win32' ? 'claude.exe' : 'claude'
    const nodeModulesBin = join(tmpDir, 'node_modules', '.bin', binaryName)
    if (existsSync(nodeModulesBin)) {
      copyFileSync(nodeModulesBin, join(resourcesDir, binaryName))
      console.log(`Claude binary downloaded and bundled to: ${resourcesDir}`)
    } else {
      console.error('Could not find downloaded Claude binary')
      process.exit(1)
    }
    // Cleanup
    execSync(`rm -rf "${tmpDir}"`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
```

Add a `postinstall` script to `package.json`:

```json
"scripts": {
  "postinstall": "node scripts/download-claude.mjs",
  // ...existing scripts
}
```

- [ ] **Step 2: Update electron-builder config to bundle the binary**

Modify `electron-builder.config.ts`:

```typescript
import type { Configuration } from 'electron-builder'

export default {
  appId: 'com.bii.agent-harness',
  productName: 'BII Agent Harness',
  directories: { output: 'dist' },
  files: ['out/**/*'],
  extraResources: [
    { from: 'resources/claude-bin', to: 'claude-bin', filter: ['**/*'] },
  ],
  win: { target: 'nsis', icon: 'resources/icon.ico' },
  mac: { target: 'dmg', icon: 'resources/icon.icns', category: 'public.app-category.productivity' },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
} satisfies Configuration
```

- [ ] **Step 3: Update ClaudeAdapter to use bundled binary first**

Modify `src/main/adapters/claude.adapter.ts`:

- Add import: `import { app } from 'electron'`
- Create a `getClaudeBinaryPath()` helper that checks bundled resource first, falls back to PATH:

```typescript
import { app } from 'electron'

function getClaudeBinaryPath(): string {
  try {
    const bundled = app.isPackaged
      ? path.join(process.resourcesPath, 'claude-bin', process.platform === 'win32' ? 'claude.exe' : 'claude')
      : path.join(__dirname, '..', '..', '..', 'resources', 'claude-bin', process.platform === 'win32' ? 'claude.exe' : 'claude')
    if (require('fs').existsSync(bundled)) return bundled
  } catch { /* fallback */ }
  return 'claude' // fallback to PATH
}
```

Update all `spawn('claude', ...)` calls to use `spawn(getClaudeBinaryPath(), ...)`.

- [ ] **Step 4: Update isAvailable to use getClaudeBinaryPath**

```typescript
async isAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const p = spawn(getClaudeBinaryPath(), ['--version'], { stdio: 'pipe' })
    p.on('close', code => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
},
```

- [ ] **Step 5: Run lint + build**

Run: `npm run lint; if ($?) { npm run build }`
Expected: Clean lint, clean build.

- [ ] **Step 6: Commit**

```bash
git add scripts/download-claude.mjs package.json electron-builder.config.ts src/main/adapters/claude.adapter.ts
git commit -m "feat: bundle Claude Code binary in installer"
```
