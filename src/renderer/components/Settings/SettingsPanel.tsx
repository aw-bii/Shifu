import { useState, useEffect } from 'react'
import { getSetting, setSetting, getAppVersion } from '../../ipc'

interface Props {
  onClose: () => void
  onReRunWizard: () => void
}

export function SettingsPanel({ onClose, onReRunWizard }: Props) {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [version, setVersion] = useState('')

  useEffect(() => {
    getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    getSetting('theme').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setTheme(v as typeof theme)
    })
  }, [])

  const handleThemeChange = async (t: 'system' | 'light' | 'dark') => {
    setTheme(t)
    await setSetting('theme', t)
    if (t === 'dark') document.documentElement.classList.add('dark')
    else if (t === 'light') document.documentElement.classList.remove('dark')
    else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">Settings</span>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Close
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Theme</label>
          <select
            className="w-full text-xs border rounded px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600"
            value={theme}
            onChange={e => handleThemeChange(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <button
            onClick={onReRunWizard}
            className="text-xs w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          Version {version || '0.1.0'}
        </div>
      </div>
    </div>
  )
}
