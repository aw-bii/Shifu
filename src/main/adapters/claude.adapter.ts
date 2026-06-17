import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk } from '../../shared/types'

export class ClaudeAdapter implements BackendAdapter {
  id = 'claude'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('claude', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string): AsyncIterable<MessageChunk> {
    const args = ['--output-format', 'stream-json', '--print']
    if (persona) args.push('--system-prompt', persona)
    args.push('--', message)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('claude', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line)
          const chunk = parseClaudeEvent(json)
          if (chunk) { chunks.push(chunk); resolve?.() }
        } catch { /* skip malformed lines */ }
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    this.proc.on('error', (err) => {
      done = true
      chunks.push({ type: 'error', content: err.message })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseClaudeEvent(event: any): MessageChunk | null {
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { type: 'text', content: event.delta.text, raw: event }
  }
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    return { type: 'tool_use', content: event.content_block.name ?? '', raw: event }
  }
  if (event.type === 'error') {
    return { type: 'error', content: event.error?.message ?? 'Unknown error', raw: event }
  }
  return null
}
