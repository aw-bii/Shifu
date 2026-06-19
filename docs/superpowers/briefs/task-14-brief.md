### Task 14: App Root + Layout

**Files:**

- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/main.tsx`

**Interfaces:**

- Consumes: `SetupWizard`, `Sidebar`, `ChatView`, `PersonaPanel`, `BackendSwitcher`
- Produces: complete working app — wizard gate on first launch, main layout thereafter

- [ ] **Step 1: Write `src/renderer/App.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { SetupWizard } from './components/Wizard/SetupWizard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { PersonaPanel } from './components/Personas/PersonaPanel'
import { BackendSwitcher } from './components/BackendSwitcher'

function App() {
  const [wizardDone, setWizardDone] = useState(() => localStorage.getItem('wizardDone') === '1')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [backend, setBackend] = useState('claude')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [showPersonas, setShowPersonas] = useState(false)

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={id => setActiveConvId(id)}
        onNew={() => setActiveConvId(null)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <BackendSwitcher value={backend} onChange={setBackend} />
          <button
            onClick={() => setShowPersonas(v => !v)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Personas
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <ChatView
            conversationId={activeConvId}
            backend={backend}
            personaId={personaId ?? undefined}
            onNewConversation={id => setActiveConvId(id)}
          />
          {showPersonas && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PersonaPanel activePersonaId={personaId} onSelect={setPersonaId} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2: Ensure `src/renderer/main.tsx` imports App and index.css**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Run the full app and smoke test**

```bash
npm run dev
```

Verify manually:
- First launch shows wizard (3 steps, Claude always ✅)
- After wizard completes, main layout appears
- Can type a message, send to Claude, see streaming response
- New conversation auto-created
- Backend switcher changes active backend
- Persona panel opens/closes; personas can be created and selected
- Sidebar lists conversations; clicking one loads its messages
- Search finds messages by keyword

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/main.tsx
git commit -m "feat: app root with wizard gate, chat layout, persona + backend toolbar"
```

---

