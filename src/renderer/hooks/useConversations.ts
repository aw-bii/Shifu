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
