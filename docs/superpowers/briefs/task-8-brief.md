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

