import pino from 'pino'

export const logger = pino({
  name: 'feed-service',
  level: process.env.LOG_LEVEL ?? 'info',
})
