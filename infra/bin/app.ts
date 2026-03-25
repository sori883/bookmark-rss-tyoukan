#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { BookmarkRssStack } from '../lib/bookmark-rss-stack'

const app = new cdk.App()
const stage = app.node.tryGetContext('stage') ?? 'dev'

new BookmarkRssStack(app, `BookmarkRss-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
})
