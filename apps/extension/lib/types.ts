export type Message =
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'CREATE_BOOKMARK'; url: string }

export type CheckAuthData = {
  authenticated: boolean
}

export type MessageResponse<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; authRequired?: boolean }
