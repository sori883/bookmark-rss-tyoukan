import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import type { Construct } from 'constructs'

export interface SchedulersProps {
  readonly stage: string
  readonly feedFunctionUrl: string
  readonly aiEndpointArn: string
}

/**
 * EventBridge Scheduler を作成する
 * - feed:fetch: 30分ごとに feed Lambda の /feeds/fetch を POST
 * - ai:digest: 毎朝 JST 9:00 (UTC 0:00) に ai エンドポイントへ POST /digest
 */
export function createSchedulers(
  scope: Construct,
  props: SchedulersProps,
): void {
  const { stage } = props

  createFeedFetchScheduler(scope, stage, props.feedFunctionUrl)
  createAiDigestScheduler(scope, stage, props.aiEndpointArn)
}

function createFeedFetchScheduler(
  scope: Construct,
  stage: string,
  feedFunctionUrl: string,
): void {
  const schedulerRole = new iam.Role(scope, 'FeedFetchSchedulerRole', {
    roleName: `bookmark-rss-feed-fetch-scheduler-${stage}`,
    assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
  })

  // Universal Target の場合、API 呼び出し権限は不要
  // Lambda Function URL への HTTP リクエストなので invoke 権限が必要
  schedulerRole.addToPolicy(
    new iam.PolicyStatement({
      actions: ['lambda:InvokeFunctionUrl'],
      resources: ['*'],
    }),
  )

  new scheduler.CfnSchedule(scope, 'FeedFetchSchedule', {
    name: `bookmark-rss-feed-fetch-${stage}`,
    scheduleExpression: 'rate(30 minutes)',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: 'arn:aws:scheduler:::aws-sdk:lambda:invokeFunctionUrl',
      roleArn: schedulerRole.roleArn,
      input: JSON.stringify({
        Url: `${feedFunctionUrl}feeds/fetch`,
        HttpMethod: 'POST',
        InvocationType: 'BUFFERED_RESPONSE',
      }),
    },
  })
}

function createAiDigestScheduler(
  scope: Construct,
  stage: string,
  aiEndpointArn: string,
): void {
  const schedulerRole = new iam.Role(scope, 'AiDigestSchedulerRole', {
    roleName: `bookmark-rss-ai-digest-scheduler-${stage}`,
    assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
  })

  schedulerRole.addToPolicy(
    new iam.PolicyStatement({
      actions: ['bedrock-agentcore:InvokeRuntimeEndpoint'],
      resources: [aiEndpointArn],
    }),
  )

  new scheduler.CfnSchedule(scope, 'AiDigestSchedule', {
    name: `bookmark-rss-ai-digest-${stage}`,
    // UTC 0:00 = JST 9:00
    scheduleExpression: 'cron(0 0 * * ? *)',
    scheduleExpressionTimezone: 'UTC',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: aiEndpointArn,
      roleArn: schedulerRole.roleArn,
      input: JSON.stringify({
        path: '/digest',
        httpMethod: 'POST',
        body: '{}',
      }),
    },
  })
}
