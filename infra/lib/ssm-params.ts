import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'

/**
 * SSM パラメータキー名の定義
 * 値はユーザーが手動で事前設定する
 */
const PARAM_KEYS = [
  'database-url',
  'google-client-id',
  'google-client-secret',
  'better-auth-secret',
  'better-auth-url',
  'web-origin',
  'ai-client-id',
  'ai-client-secret',
  'bedrock-model-id',
] as const

export type SsmParamKey = (typeof PARAM_KEYS)[number]

export interface SsmParams {
  readonly values: Record<SsmParamKey, string>
}

/**
 * SSM Parameter Store から既存パラメータを参照する
 * CDK では値の作成は行わない（手動設定前提）
 */
export function lookupSsmParams(scope: Construct, stage: string): SsmParams {
  const values = Object.fromEntries(
    PARAM_KEYS.map((key) => [
      key,
      ssm.StringParameter.valueForStringParameter(
        scope,
        `/bookmark-rss/${stage}/${key}`,
      ),
    ]),
  ) as Record<SsmParamKey, string>

  return { values }
}
