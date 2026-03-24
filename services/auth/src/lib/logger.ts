import pino from 'pino'

export function createLogger(level = 'info'): pino.Logger {
  return pino({
    level,
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino/file', options: { destination: 1 } }
        : undefined,
  })
}
