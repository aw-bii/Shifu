# P1 Ship Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship-ready features: conversation CRUD (delete/rename), app icons for distribution builds, and CI/CD automation.

**Architecture:** Conversation delete/rename adds IPC channels `conv:delete` and `conv:rename` backed by new `ConvStore` methods, plus UI delete button on `ConvItem` and inline rename. App icons are generated as PNGs and converted to `.ico`/`.icns`. CI/CD uses GitHub Actions with Electron Builder for macOS/Windows.

**Tech Stack:** Electron, electron-builder, GitHub Actions, better-sqlite3, sharp (for icon generation)

---

### Task 1: Conversation Deletion

**Files:**
- Modify: `src/shared/ipc.ts` (add `CONV_DELETE` channel)
- Modify: `src/main/ipc.ts` (add `conv:delete` handler)
- Modify: `src/main/store/index.ts` (add `deleteConversation` method)
- Modify: `src/renderer/ipc.ts` (add `deleteConversation` wrapper)
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx` (add delete button)
- Modify: `src/renderer/hooks/useConversations.ts` (add `remove` callback)

- [ ] **Step 1: Add IPC channel constant**

In `src/shared/ipc.ts`, add to the `IPC` const:

```typescript
CONV_DELETE: 'conv:delete',
```

Add to `IpcInvokeMap`:

```typescript
[IPC.CONV_DELETE]: { conversationId: string }
```

- [ ] **Step 2: Add ConvStore.deleteConversation**

In `src/main/store/index.ts`, add after `searchMessages`:

```typescript
deleteConversation(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
},
```

- [ ] **Step 3: Add IPC handler in src/main/ipc.ts**

```typescript
ipcMain.handle(IPC.CONV_DELETE, (_event, { conversationId }) => {
  ConvStore.deleteConversation(conversationId)
})
```

- [ ] **Step 4: Add renderer IPC wrapper in src/renderer/ipc.ts**

```typescript
export async function deleteConversation(conversationId: string): Promise<void> {
  await window.ipc.invoke(IPC.CONV_DELETE, { conversationId })
}
```

- [ ] **Step 5: Add delete button to ConvItem**

Modify `src/renderer/components/Sidebar/ConvItem.tsx`:

```typescript
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
  onDelete: (id: string) => void
}

export function ConvItem({ conversation, active, onClick, onDelete }: Props) {
  const isPipeline = conversation.pipelineTemplateId !== null

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={onClick}
        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          active ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
      >
        <div className="font-medium truncate flex items-center gap-1">
          {isPipeline && (
            <svg className="w-3 h-3 flex-shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-5-1h2v2H7V7zm0-4h2v2H7V3z" />
            </svg>
          )}
          <span className="truncate">{conversation.title}</span>
        </div>
        <div className="text-xs text-gray-400 flex gap-2">
          <span>{isPipeline ? 'pipeline' : conversation.backend}</span>
          <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(conversation.id) }}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
        aria-label="Delete conversation"
        title="Delete"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Wire delete through ConvList and Sidebar**

In `ConvList.tsx`, accept `onDelete` prop and pass to `ConvItem`:

```typescript
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

// Inside the map:
<ConvItem
  key={conv.id}
  conversation={conv}
  active={conv.id === activeId}
  onClick={() => onSelect(conv.id)}
  onDelete={onDelete}
/>
```

In `Sidebar.tsx`, accept and forward `onDelete`:

```typescript
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

// Pass to ConvList:
<ConvList activeId={activeId} onSelect={onSelect} onDelete={onDelete} searchInputRef={searchInputRef} />
```

In `App.tsx`, wire `onDelete` to delete via IPC + refresh sidebar + clear active if deleted:

```typescript
import { deleteConversation } from './ipc'
import { useConversations } from './hooks/useConversations'

// Inside App component, add before return:
const { refresh } = useConversations()

const handleDelete = async (id: string) => {
  await deleteConversation(id)
  if (activeConvId === id) {
    setActiveConvId(null)
    setActiveConvMeta(null)
  }
  refresh()
}
```

Remove the second `useConversations()` call — `ConvList` already has its own. Instead, pass `onDelete={handleDelete}` to `Sidebar`.

- [ ] **Step 7: Run build + lint**

Run: `npm run lint; if ($?) { npm run build }`
Expected: Clean lint, clean build.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/main/store/index.ts src/renderer/ipc.ts src/renderer/components/Sidebar/ConvItem.tsx src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Sidebar/Sidebar.tsx src/renderer/App.tsx
git commit -m "feat: add conversation deletion"
```

---

### Task 2: Conversation Title Renaming

**Files:**
- Modify: `src/shared/ipc.ts` (add `CONV_RENAME` channel)
- Modify: `src/main/ipc.ts` (add handler)
- Modify: `src/main/store/index.ts` (add `renameConversation`)
- Modify: `src/renderer/ipc.ts` (add wrapper)
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx` (add inline rename)

- [ ] **Step 1: Add IPC channel constant**

In `src/shared/ipc.ts`:

```typescript
CONV_RENAME: 'conv:rename',
```

In `IpcInvokeMap`:

```typescript
[IPC.CONV_RENAME]: { conversationId: string; title: string }
```

- [ ] **Step 2: Add ConvStore.renameConversation**

In `src/main/store/index.ts`:

```typescript
renameConversation(id: string, title: string): void {
  getDb().prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, Date.now(), id)
},
```

- [ ] **Step 3: Add IPC handler in src/main/ipc.ts**

```typescript
ipcMain.handle(IPC.CONV_RENAME, (_event, { conversationId, title }) => {
  if (typeof title !== 'string' || title.trim().length === 0) throw new Error('Title must be a non-empty string')
  ConvStore.renameConversation(conversationId, title.trim())
})
```

- [ ] **Step 4: Add renderer IPC wrapper**

In `src/renderer/ipc.ts`:

```typescript
export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await window.ipc.invoke(IPC.CONV_RENAME, { conversationId, title })
}
```

- [ ] **Step 5: Add inline rename to ConvItem**

Modify `ConvItem.tsx` to toggle between title display and an input field on double-click:

```typescript
import { useState } from 'react'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function ConvItem({ conversation, active, onClick, onDelete, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)
  const isPipeline = conversation.pipelineTemplateId !== null

  const handleSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-3 py-1">
        <input
          className="w-full text-sm px-2 py-1 rounded border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-800 focus:outline-none"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') setEditing(false) }}
          onBlur={handleSubmit}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={onClick}
        onDoubleClick={() => { setEditValue(conversation.title); setEditing(true) }}
        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          active ? 'bg-gray-200 dark:bg-gray-700' : ''
        }`}
      >
        {/* same inner content as before */}
        <div className="font-medium truncate flex items-center gap-1">
          {isPipeline && (
            <svg className="w-3 h-3 flex-shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-5-1h2v2H7V7zm0-4h2v2H7V3z" />
            </svg>
          )}
          <span className="truncate">{conversation.title}</span>
        </div>
        <div className="text-xs text-gray-400 flex gap-2">
          <span>{isPipeline ? 'pipeline' : conversation.backend}</span>
          <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(conversation.id) }}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
        aria-label="Delete conversation"
        title="Delete"
      >
        {/* trash svg */}
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9 2a1 1 0 0 0-.894.553L7.382 4H4a1 1 0 0 0 0 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a1 1 0 1 0 0-2h-3.382l-.724-1.447A1 1 0 0 0 11 2H9zM7 8a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0V8zm5-1a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Wire rename through ConvList → Sidebar → App**

In `ConvList.tsx`, add `onRename` prop and pass to `ConvItem`:

```typescript
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

<ConvItem
  key={conv.id}
  conversation={conv}
  active={conv.id === activeId}
  onClick={() => onSelect(conv.id)}
  onDelete={onDelete}
  onRename={onRename}
/>
```

In `Sidebar.tsx`, add `onRename` prop and pass through:

```typescript
interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

<ConvList ... onRename={onRename} />
```

In `App.tsx`, wire `handleRename`:

```typescript
import { renameConversation } from './ipc'

const handleRename = async (id: string, title: string) => {
  await renameConversation(id, title)
  refresh()
}

// Pass to Sidebar:
<Sidebar ... onRename={handleRename} />
```

- [ ] **Step 7: Run build**

Run: `npm run build`
Expected: Success.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/main/store/index.ts src/renderer/ipc.ts src/renderer/components/Sidebar/ConvItem.tsx src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Sidebar/Sidebar.tsx src/renderer/App.tsx
git commit -m "feat: add conversation rename (double-click to edit title)"
```

---

### Task 3: App Icons

**Files:**
- Create: `scripts/generate-icons.mjs`
- Modify: `.gitignore`
- Modify: `package.json` (add icon gen script to `build` lifecycle)

- [ ] **Step 1: Create icon generation script**

Create `scripts/generate-icons.mjs`:

```javascript
// Generates app icons: 512x512 PNG, 256x256 ICO (Windows), 512x512 ICNS (macOS)
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources')

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

// Create a minimal SVG icon that electron-builder can convert or we provide PNG
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="256" y="300" font-family="sans-serif" font-size="240" font-weight="bold" fill="white" text-anchor="middle">B</text>
  <circle cx="380" cy="140" r="48" fill="#60A5FA"/>
</svg>`

async function main() {
  ensureDir(resourcesDir)

  // Write SVG
  writeFileSync(join(resourcesDir, 'icon.svg'), SVG_ICON)

  // Try to convert using sharp or just copy SVG (electron-builder can handle SVG on some platforms)
  // For now, create placeholder PNG with size info
  const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512]
  const pngSizes = sizes.map(s => `${s}x${s}`).join(' ')
  console.log(`Icons generated in ${resourcesDir}/`)
  console.log(`SVG: ${join(resourcesDir, 'icon.svg')}`)

  // On macOS, try to create ICNS with iconutil if on macOS
  if (process.platform === 'darwin') {
    console.log('On macOS — consider running: npx sharp-cli -i icon.svg -o icon.png resize 512')
    console.log('Then convert to ICNS with: iconutil -c icns icon.iconset')
  }
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Generate actual icons**

Run: `node scripts/generate-icons.mjs`
Expected: Creates `resources/icon.svg`.

Then create PNG icons from the SVG. For a quick generation:

```bash
# Install sharp if not available
npm install --save-dev sharp
```

Create a one-shot conversion in the script or run manually:

```javascript
// Add to the end of generate-icons.mjs:
const sharp = (await import('sharp')).default

// Generate PNG at 512x512
await sharp(Buffer.from(SVG_ICON)).resize(512, 512).png().toFile(join(resourcesDir, 'icon.png'))

// Generate ICO requires multiple PNG sizes. On Windows, electron-builder can handle this.
// Write the PNG — electron-builder will convert as needed.
```

Run again: `node scripts/generate-icons.mjs`
Expected: `resources/icon.png` and `resources/icon.svg` exist.

For ICO on Windows, electron-builder needs `resources/icon.ico`. Create a small placeholder:

```bash
# Download a tool or use ImageMagick to convert
# If ImageMagick is available:
# magick convert resources/icon.png -define icon:auto-resize=256,128,64,48,32,16 resources/icon.ico
```

- [ ] **Step 3: Add icon generation to build lifecycle**

In `package.json`, add a `prebuild` script:

```json
"scripts": {
  "prebuild": "node scripts/generate-icons.mjs",
  // ... existing scripts
}
```

- [ ] **Step 4: Run dist to verify icons are bundled**

Run: `npm run build; if ($?) { npm run dist }`
Expected: Build succeeds, `dist/` contains an installer with the icon.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-icons.mjs package.json resources/
git commit -m "chore: add app icons for distribution builds"
```

---

### Task 4: CI/CD Pipeline

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create GitHub Actions release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g. v0.1.0)'
        required: true

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate icons
        run: node scripts/generate-icons.mjs

      - name: Build and package
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run dist

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: installer-${{ matrix.os }}
          path: dist/*.{exe,dmg,AppImage,deb,rpm,zip}
          if-no-files-found: warn

  create-release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          pattern: installer-*
          merge-multiple: true

      - name: Generate release notes
        id: notes
        run: |
          echo "## BII Agent Harness Release" > release-notes.md
          echo "" >> release-notes.md
          echo "Download the installer for your platform below." >> release-notes.md

      - uses: softprops/action-gh-release@v2
        with:
          name: BII Agent Harness ${{ github.ref_name }}
          body_path: release-notes.md
          files: |
            *.exe
            *.dmg
            *.AppImage
            *.deb
            *.rpm
```

- [ ] **Step 2: Add CI for PRs (lint + test)**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions for CI and release builds"
```
