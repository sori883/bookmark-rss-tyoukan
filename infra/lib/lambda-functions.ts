import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import type { Construct } from 'constructs'
import type { SsmParams } from './ssm-params'

export interface LambdaFunctionsProps {
  readonly stage: string
  readonly ssm: SsmParams
}

export interface LambdaFunctionsResult {
  readonly auth: NodejsFunction
  readonly bff: NodejsFunction
  readonly feed: NodejsFunction
  readonly notification: NodejsFunction
  readonly urls: {
    readonly auth: string
    readonly bff: string
    readonly feed: string
    readonly notification: string
  }
}

/**
 * 共通の Lambda 設定を返す
 */
function baseNodejsProps(
  serviceName: string,
  stage: string,
  memorySize: number,
): Partial<ConstructorParameters<typeof NodejsFunction>[2]> {
  return {
    functionName: `bookmark-rss-${serviceName}-${stage}`,
    entry: path.join(__dirname, `../../services/${serviceName}/src/lambda.ts`),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    memorySize,
    timeout: cdk.Duration.seconds(30),
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'node22',
      format: OutputFormat.ESM,
    },
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
    },
  }
}

/**
 * 4 つの TypeScript Lambda 関数を作成する
 * 環境変数のサービス間 URL は後から addEnvironment() で追加する（循環参照回避）
 */
export function createLambdaFunctions(
  scope: Construct,
  props: LambdaFunctionsProps,
): LambdaFunctionsResult {
  const { stage, ssm } = props

  const auth = createAuthFunction(scope, stage, ssm)
  const feed = createFeedFunction(scope, stage, ssm)
  const bff = createBffFunction(scope, stage, ssm)
  const notification = createNotificationFunction(scope, stage, ssm)

  // Function URL を有効化（IAM 認証なし）
  const authUrl = auth.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
  const feedUrl = feed.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
  const bffUrl = bff.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
  const notifUrl = notification.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })

  // サービス間 URL を環境変数に追加
  addServiceUrls(auth, { AUTH_SERVICE_URL: authUrl.url })
  addServiceUrls(bff, {
    AUTH_JWKS_URL: cdk.Fn.join('', [authUrl.url, 'auth/.well-known/jwks.json']),
    FEED_SERVICE_URL: feedUrl.url,
    NOTIFICATION_SERVICE_URL: notifUrl.url,
  })
  addServiceUrls(feed, {
    AUTH_JWKS_URL: cdk.Fn.join('', [authUrl.url, 'auth/.well-known/jwks.json']),
  })
  addServiceUrls(notification, {
    AUTH_JWKS_URL: cdk.Fn.join('', [authUrl.url, 'auth/.well-known/jwks.json']),
  })

  return {
    auth,
    bff,
    feed,
    notification,
    urls: {
      auth: authUrl.url,
      bff: bffUrl.url,
      feed: feedUrl.url,
      notification: notifUrl.url,
    },
  }
}

function createAuthFunction(
  scope: Construct,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'AuthFunction', {
    ...baseNodejsProps('auth', stage, 256),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
      GOOGLE_CLIENT_ID: ssm.values['google-client-id'],
      GOOGLE_CLIENT_SECRET: ssm.values['google-client-secret'],
      BETTER_AUTH_SECRET: ssm.values['better-auth-secret'],
    },
  })
}

function createFeedFunction(
  scope: Construct,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'FeedFunction', {
    ...baseNodejsProps('feed', stage, 512),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
    },
  })
}

function createBffFunction(
  scope: Construct,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'BffFunction', {
    ...baseNodejsProps('bff', stage, 256),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
    },
  })
}

function createNotificationFunction(
  scope: Construct,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'NotificationFunction', {
    ...baseNodejsProps('notification', stage, 256),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
    },
  })
}

function addServiceUrls(
  fn: NodejsFunction,
  urls: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(urls)) {
    fn.addEnvironment(key, value)
  }
}
