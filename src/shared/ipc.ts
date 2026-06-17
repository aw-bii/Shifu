// IPC channel name constants — import from here everywhere; never use raw string literals.

export const IPC = {
  PING: 'ping',
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',
  CHAT_CHUNK: 'chat:chunk',
  CONVERSATION_LIST: 'conversation:list',
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_DELETE: 'conversation:delete',
  MESSAGE_LIST: 'message:list',
  WIZARD_START: 'wizard:start',
  WIZARD_SUBMIT: 'wizard:submit',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
