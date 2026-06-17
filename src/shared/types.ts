// Shared types used by both main and renderer processes.
// No Electron-specific imports here — this file runs in both contexts.

export type AgentId = 'claude' | 'gemini' | 'opencode'

export interface MessageChunk {
  type: 'text' | 'error' | 'done'
  content: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  agentId: AgentId
}

export interface Conversation {
  id: string
  title: string
  agentId: AgentId
  createdAt: number
  updatedAt: number
}
