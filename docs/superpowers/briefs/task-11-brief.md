### Task 11: Conversation Sidebar

**Files:**

- Create: `src/renderer/components/Sidebar/ConvItem.tsx`
- Create: `src/renderer/components/Sidebar/ConvList.tsx`
- Create: `src/renderer/components/Sidebar/Sidebar.tsx`

**Interfaces:**

- Consumes: `useConversations`, `Conversation` type
- Produces: `<Sidebar activeId={string|null} onSelect={(id)=>void} onNew={()=>void} />`

- [ ] **Step 1: Write `src/renderer/components/Sidebar/ConvItem.tsx`**

```tsx
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

export function ConvItem({ conversation, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700' : ''
      }`}
    >
      <div className="font-medium truncate">{conversation.title}</div>
      <div className="text-xs text-gray-400 flex gap-2">
        <span>{conversation.backend}</span>
        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Write `src/renderer/components/Sidebar/ConvList.tsx`**

```tsx
import { useState } from 'react'
import { useConversations } from '../../../hooks/useConversations'
import { ConvItem } from './ConvItem'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConvList({ activeId, onSelect }: Props) {
  const { conversations, search } = useConversations()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conversationId: string }[] | null>(null)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    const results = await search(q)
    setSearchResults(results)
  }

  const displayed = searchResults
    ? conversations.filter(c => searchResults.some(r => r.conversationId === c.id))
    : conversations

  return (
    <div className="flex flex-col gap-1">
      <input
        className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
      />
      {displayed.map(conv => (
        <ConvItem
          key={conv.id}
          conversation={conv}
          active={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/renderer/components/Sidebar/Sidebar.tsx`**

```tsx
import { ConvList } from './ConvList'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function Sidebar({ activeId, onSelect, onNew }: Props) {
  return (
    <div className="w-64 flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">BII Agent Harness</span>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList activeId={activeId} onSelect={onSelect} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar/
git commit -m "feat: conversation sidebar with search"
```

---

