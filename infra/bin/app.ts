#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { BookmarkRssStack } from '../lib/bookmark-rss-stack'

const app = new cdk.App()
const stage = app.node.tryGetContext('stage') ?? 'dev'
const prefix = app.node.tryGetContext('prefix') ?? 'bookmark-rss'

new BookmarkRssStack(app, `${prefix}-${stage}`, {
  stage,
  prefix,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
})
