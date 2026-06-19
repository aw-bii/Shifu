### Task 10: Chat UI Components

**Files:**

- Create: `src/renderer/components/Chat/MessageBubble.tsx`
- Create: `src/renderer/components/Chat/MessageList.tsx`
- Create: `src/renderer/components/Chat/InputBar.tsx`
- Create: `src/renderer/components/Chat/ChatView.tsx`

**Interfaces:**

- Consumes: `useMessages`, `Message` from shared types
- Produces: `<ChatView conversationId={string|null} backend={string} personaId={string|undefined} onNewConversation={(id)=>void} />`

- [ ] **Step 1: Install markdown renderer**

```bash
npm install react-markdown
```

- [ ] **Step 2: Write `src/renderer/components/Chat/MessageBubble.tsx`**

```tsx
import ReactMarkdown from 'react-markdown'
import type { Message } from '../../../../shared/types'

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      }`}>
        {isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{message.content}</ReactMarkdown>
        }
        <div className="text-xs opacity-50 mt-1">
          {message.backend} · {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/renderer/components/Chat/MessageList.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../../../../shared/types'

interface Props { messages: Message[]; streaming: boolean }

export function MessageList({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
      {streaming && (
        <div className="flex justify-start mb-3">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
            <span className="animate-pulse text-sm text-gray-500">thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 4: Write `src/renderer/components/Chat/InputBar.tsx`**

```tsx
import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  onAbort: () => void
  streaming: boolean
  disabled?: boolean
}

export function InputBar({ onSend, onAbort, streaming, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || streaming) return
    onSend(trimmed)
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={disabled}
        />
        {streaming
          ? <button onClick={onAbort} className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600">Stop</button>
          : <button onClick={submit} disabled={!value.trim() || disabled} className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">Send</button>
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/renderer/components/Chat/ChatView.tsx`**

```tsx
import { useMessages } from '../../../hooks/useMessages'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'

interface Props {
  conversationId: string | null
  backend: string
  personaId?: string
  onNewConversation: (id: string) => void
}

export function ChatView({ conversationId, backend, personaId, onNewConversation }: Props) {
  const { messages, streaming, send, abort } = useMessages(conversationId)

  const handleSend = async (message: string) => {
    const newId = await send(message, backend, personaId)
    if (!conversationId && newId) onNewConversation(newId)
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Start a conversation
        </div>
      )}
      {(messages.length > 0 || streaming) && (
        <MessageList messages={messages} streaming={streaming} />
      )}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/
git commit -m "feat: Chat UI components (MessageBubble, MessageList, InputBar, ChatView)"
```

---

