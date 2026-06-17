import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import { AdapterManager } from './adapters/manager'
import { ConvStore } from './store'
import { probeBackend } from './wizard/probe'
import { installBackend } from './wizard/install'

export function registerIpcHandlers(_win: BrowserWindow): void {
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
    // renderer handles its own localStorage
  })
}
