import { useState } from 'react'
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
