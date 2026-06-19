import { spawn } from 'child_process'

const INSTALL_COMMANDS: Record<string, [string, string[]]> = {
  gemini:   ['npm', ['install', '-g', '@google/gemini-cli']],
  opencode: ['npm', ['install', '-g', 'opencode']],
}

export function installBackend(id: string, onData: (line: string) => void): Promise<{ success: boolean; error?: string }> {
  const cmd = INSTALL_COMMANDS[id]
  if (!cmd) return Promise.resolve({ success: false, error: `Unknown backend: ${id}` })

  const [binary, args] = cmd
  return new Promise(resolve => {
    const p = spawn(binary, args, { stdio: 'pipe' })
    let stderrOutput = ''
    p.stdout!.on('data', (buf: Buffer) => buf.toString().split('\n').filter(Boolean).forEach(onData))
    p.stderr!.on('data', (buf: Buffer) => {
      const text = buf.toString()
      stderrOutput += text
      text.split('\n').filter(Boolean).forEach(onData)
    })
    p.on('close', code => {
      if (code === 0) return resolve({ success: true })
      const isPermissionError = /EACCES|EPERM|access denied|permission denied/i.test(stderrOutput)
      resolve({
        success: false,
        error: isPermissionError
          ? `Permission denied. Try running as administrator${process.platform === 'win32' ? ' (right-click terminal → Run as Administrator)' : ' (sudo npm install -g ...)'}`
          : `Install failed with exit code ${code}. See output above.`,
      })
    })
    p.on('error', (err) => resolve({ success: false, error: `Failed to start installer: ${err.message}` }))
  })
}
