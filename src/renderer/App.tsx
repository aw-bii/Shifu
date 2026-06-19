import { useState, useEffect, useRef, useCallback } from 'react'
import { SetupWizard } from './components/Wizard/SetupWizard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { PersonaPanel } from './components/Personas/PersonaPanel'
import { PipelinePanel } from './components/Pipelines/PipelinePanel'
import { SettingsPanel } from './components/Settings/SettingsPanel'
import { BackendSwitcher } from './components/BackendSwitcher'
import { usePipelines } from './hooks/usePipelines'
import { getConversation, setSetting, deleteConversation, renameConversation, getSetting } from './ipc'
import type { PipelineTemplate, Conversation } from '../shared/types'

function App() {
  const [wizardDone, setWizardDone] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('wizardDone') === '1') {
      setWizardDone(true)
      return
    }
    getSetting('wizard_done').then(val => {
      if (val === '1') {
        localStorage.setItem('wizardDone', '1')
        setWizardDone(true)
      }
    })
  }, [])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvMeta, setActiveConvMeta] = useState<Conversation | null>(null)
  const [mode, setMode] = useState<'single' | 'pipeline'>('single')
  const [backend, setBackend] = useState('claude')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null)
  const [showPersonas, setShowPersonas] = useState(false)
  const [showPipelines, setShowPipelines] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { templates } = usePipelines()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleDelete = useCallback(async (id: string) => {
    await deleteConversation(id)
    if (activeConvId === id) {
      setActiveConvId(null)
      setActiveConvMeta(null)
    }
    setRefreshTrigger(n => n + 1)
  }, [activeConvId])

  const handleRename = useCallback(async (id: string, title: string) => {
    await renameConversation(id, title)
    setRefreshTrigger(n => n + 1)
  }, [])

  // Load metadata for active conversation to detect pipeline mode
  useEffect(() => {
    if (!activeConvId) { setActiveConvMeta(null); return }
    getConversation(activeConvId).then(({ conversation }) => setActiveConvMeta(conversation))
  }, [activeConvId])

  // Derive the active pipeline template from loaded conversation meta or toolbar selection
  const activePipelineTemplate: PipelineTemplate | undefined = (() => {
    const templateId = activeConvMeta?.pipelineTemplateId ?? (mode === 'pipeline' ? selectedTemplate?.id : null)
    if (!templateId) return undefined
    return templates.find(t => t.id === templateId) ?? selectedTemplate ?? undefined
  })()

  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const handleNew = useCallback(() => {
    setActiveConvId(null)
    setActiveConvMeta(null)
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

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={id => setActiveConvId(id)}
        onNew={handleNew}
        onDelete={handleDelete}
        onRename={handleRename}
        searchInputRef={searchInputRef}
        refreshTrigger={refreshTrigger}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              onClick={() => { setMode('single'); setSelectedTemplate(null) }}
              className={`px-3 py-1 ${mode === 'single' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Single
            </button>
            <button
              onClick={() => setMode('pipeline')}
              className={`px-3 py-1 ${mode === 'pipeline' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Pipeline
            </button>
          </div>

          {mode === 'single' && !activeConvMeta?.pipelineTemplateId && (
            <BackendSwitcher value={backend} onChange={setBackend} />
          )}

          {(mode === 'pipeline' || activeConvMeta?.pipelineTemplateId) && (
            <select
              className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
              value={activePipelineTemplate?.id ?? ''}
              onChange={e => {
                const t = templates.find(x => x.id === e.target.value)
                setSelectedTemplate(t ?? null)
              }}
              disabled={!!activeConvMeta?.pipelineTemplateId}
            >
              <option value="">Select pipeline…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => { setShowPersonas(v => !v); setShowPipelines(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 ml-auto"
          >
            Personas
          </button>
          <button
            onClick={() => { setShowPipelines(v => !v); setShowPersonas(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Pipelines
          </button>
          <button
            onClick={() => setShowSettings(v => !v)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {!activeConvId && mode === 'single' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold mb-2">Welcome to BII Agent Harness</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
                Chat with Claude Code, Gemini CLI, and Opencode from one place. Start a new conversation or pick one from the sidebar.
              </p>
              <button
                onClick={handleNew}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            <ChatView
              conversationId={activeConvId}
              backend={backend}
              personaId={personaId ?? undefined}
              pipelineTemplate={activePipelineTemplate}
              onNewConversation={id => setActiveConvId(id)}
            />
          )}
          {showPersonas && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PersonaPanel activePersonaId={personaId} onSelect={setPersonaId} />
            </div>
          )}
          {showPipelines && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={t => { setSelectedTemplate(t); setMode('pipeline') }}
              />
            </div>
          )}
          {showSettings && (
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onReRunWizard={() => {
                localStorage.removeItem('wizardDone')
                setWizardDone(false)
                setSetting('wizard_done', '0')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
