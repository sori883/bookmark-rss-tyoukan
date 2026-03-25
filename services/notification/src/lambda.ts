import { handle } from 'hono/aws-lambda'
import { buildApp } from './index'

const { app } = buildApp()

export const handler = handle(app)
