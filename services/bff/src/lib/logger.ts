import pino from 'pino'

export const logger = pino({
  name: 'bff-service',
  level: process.env.LOG_LEVEL ?? 'info',
})
