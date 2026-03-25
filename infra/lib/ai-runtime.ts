import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha'
import type { Construct } from 'constructs'
import type { SsmParams } from './ssm-params'

export interface AiRuntimeProps {
  readonly stage: string
  readonly ssm: SsmParams
  readonly authServiceUrl: string
  readonly feedServiceUrl: string
  readonly notificationServiceUrl: string
}

export interface AiRuntimeResult {
  readonly runtime: agentcore.Runtime
  readonly endpoint: agentcore.RuntimeEndpoint
}

/**
 * AgentCore Runtime で ai サービス (FastAPI) をデプロイする
 */
export function createAiRuntime(
  scope: Construct,
  props: AiRuntimeProps,
): AiRuntimeResult {
  const { stage, ssm } = props

  const artifact = agentcore.AgentRuntimeArtifact.fromCodeAsset({
    path: path.join(__dirname, '../../services/ai'),
    runtime: agentcore.AgentCoreRuntime.PYTHON_3_12,
    entrypoint: [
      'uvicorn',
      'src.main:app',
      '--host',
      '0.0.0.0',
      '--port',
      '8080',
    ],
  })

  const runtime = new agentcore.Runtime(scope, 'AiRuntime', {
    runtimeName: `bookmark_rss_ai_${stage}`,
    agentRuntimeArtifact: artifact,
    networkConfiguration:
      agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
    protocolConfiguration: agentcore.ProtocolType.HTTP,
    environmentVariables: {
      AUTH_SERVICE_URL: props.authServiceUrl,
      FEED_SERVICE_URL: props.feedServiceUrl,
      NOTIFICATION_SERVICE_URL: props.notificationServiceUrl,
      AI_CLIENT_ID: ssm.values['ai-client-id'],
      AI_CLIENT_SECRET: ssm.values['ai-client-secret'],
    },
  })

  // Bedrock InvokeModel 権限を付与
  runtime.role.addToPrincipalPolicy(
    new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }),
  )

  // エンドポイントを作成
  const endpoint = runtime.addEndpoint(
    `bookmark_rss_ai_ep_${stage}`,
  )

  return { runtime, endpoint }
}
