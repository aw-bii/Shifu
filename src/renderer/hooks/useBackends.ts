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
