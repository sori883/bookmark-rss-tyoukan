import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import { lookupSsmParams } from './ssm-params'
import { createLambdaFunctions } from './lambda-functions'
import { createAiRuntime } from './ai-runtime'
import { createApiGateway } from './api-gateway'
import { createSchedulers } from './schedulers'

export interface BookmarkRssStackProps extends cdk.StackProps {
  readonly stage: string
  readonly prefix: string
}

export class BookmarkRssStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BookmarkRssStackProps) {
    super(scope, id, props)

    const { stage, prefix } = props

    // SSM パラメータ参照（値はユーザーが手動設定済み前提）
    const ssm = lookupSsmParams(this, stage)

    // Lambda Functions (auth, feed, notification)
    const lambdaResult = createLambdaFunctions(this, { stage, prefix, ssm })

    // AgentCore Runtime (ai)
    const ai = createAiRuntime(this, {
      stage,
      prefix,
      ssm,
      authServiceUrl: lambdaResult.urls.auth,
      feedServiceUrl: lambdaResult.urls.feed,
      notificationServiceUrl: lambdaResult.urls.notification,
    })

    // API Gateway HTTP API
    const { httpApi } = createApiGateway(this, {
      stage,
      prefix,
      lambdas: lambdaResult,
    })

    // EventBridge Schedulers
    createSchedulers(this, {
      stage,
      prefix,
      feedFunctionArn: lambdaResult.feed.functionArn,
      aiEndpointArn: ai.endpoint.agentRuntimeEndpointArn,
    })

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url ?? '',
      description: 'API Gateway URL',
    })
    new cdk.CfnOutput(this, 'AiRuntimeId', {
      value: ai.runtime.agentRuntimeId,
      description: 'AgentCore Runtime ID',
    })
  }
}
