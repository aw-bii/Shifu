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

