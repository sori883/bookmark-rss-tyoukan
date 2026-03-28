import * as iam from 'aws-cdk-lib/aws-iam'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import type { Construct } from 'constructs'

export interface SchedulersProps {
  readonly stage: string
  readonly prefix: string
  readonly feedFunctionArn: string
  readonly aiRuntimeArn: string
}

/**
 * EventBridge Scheduler を作成する
 * - feed:fetch: 30分ごとに feed Lambda の /feeds/fetch を POST
 * - ai:digest: 毎時0分に ai エンドポイントへ POST /digest（ユーザーの通知時間設定に基づきJSTでフィルタ）
 */
export function createSchedulers(
  scope: Construct,
  props: SchedulersProps,
): void {
  const { stage, prefix } = props

  createFeedFetchScheduler(scope, prefix, stage, props.feedFunctionArn)
  // TODO: EventBridge Scheduler Universal TargetでAgentCoreが未対応。コンソールから手動設定 or Proxy Lambda経由で対応予定。
  // createAiDigestScheduler(scope, prefix, stage, props.aiRuntimeArn)
}

function createFeedFetchScheduler(
  scope: Construct,
  prefix: string,
  stage: string,
  feedFunctionArn: string,
): void {
  const schedulerRole = new iam.Role(scope, 'FeedFetchSchedulerRole', {
    roleName: `${prefix}-feed-fetch-scheduler-${stage}`,
    assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
  })

  schedulerRole.addToPolicy(
    new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [feedFunctionArn],
    }),
  )

  new scheduler.CfnSchedule(scope, 'FeedFetchSchedule', {
    name: `${prefix}-feed-fetch-${stage}`,
    scheduleExpression: 'rate(30 minutes)',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: feedFunctionArn,
      roleArn: schedulerRole.roleArn,
      input: JSON.stringify({
        path: '/feeds/fetch',
        httpMethod: 'POST',
        body: '{}',
      }),
    },
  })
}

function createAiDigestScheduler(
  scope: Construct,
  prefix: string,
  stage: string,
  aiRuntimeArn: string,
): void {
  const schedulerRole = new iam.Role(scope, 'AiDigestSchedulerRole', {
    roleName: `${prefix}-ai-digest-scheduler-${stage}`,
    assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
  })

  schedulerRole.addToPolicy(
    new iam.PolicyStatement({
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [
        aiRuntimeArn,
        `${aiRuntimeArn}/runtime-endpoint/DEFAULT`,
      ],
    }),
  )

  new scheduler.CfnSchedule(scope, 'AiDigestSchedule', {
    name: `${prefix}-ai-digest-${stage}`,
    scheduleExpression: 'cron(0 * * * ? *)',
    scheduleExpressionTimezone: 'Asia/Tokyo',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: 'arn:aws:scheduler:::aws-sdk:bedrock-agentcore:invokeAgentRuntime',
      roleArn: schedulerRole.roleArn,
      input: JSON.stringify({
        AgentRuntimeArn: aiRuntimeArn,
        Payload: '{}',
      }),
    },
  })
}
