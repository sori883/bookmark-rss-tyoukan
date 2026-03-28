import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as logs from 'aws-cdk-lib/aws-logs'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import type { Construct } from 'constructs'
import type { SsmParams } from './ssm-params'

export interface LambdaFunctionsProps {
  readonly stage: string
  readonly prefix: string
  readonly ssm: SsmParams
}

export interface LambdaFunctionsResult {
  readonly auth: NodejsFunction
  readonly feed: NodejsFunction
  readonly notification: NodejsFunction
  readonly authorizer: NodejsFunction
  readonly urls: {
    readonly auth: string
    readonly feed: string
    readonly notification: string
  }
}

/**
 * 共通の Lambda 設定を返す
 */
function baseNodejsProps(
  serviceName: string,
  prefix: string,
  stage: string,
  memorySize: number,
): Partial<ConstructorParameters<typeof NodejsFunction>[2]> {
  return {
    functionName: `${prefix}-${serviceName}-${stage}`,
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
      banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    logRetention: logs.RetentionDays.ONE_WEEK,
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
    },
  }
}

/**
 * 3 つの TypeScript Lambda 関数 + Authorizer を作成する
 */
export function createLambdaFunctions(
  scope: Construct,
  props: LambdaFunctionsProps,
): LambdaFunctionsResult {
  const { stage, prefix, ssm } = props

  const auth = createAuthFunction(scope, prefix, stage, ssm)
  const feed = createFeedFunction(scope, prefix, stage, ssm)
  const notification = createNotificationFunction(scope, prefix, stage, ssm)
  const authorizer = createAuthorizerFunction(scope, prefix, stage)

  // Function URL を有効化（IAM 認証なし）
  const authUrl = auth.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
  const feedUrl = feed.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })
  const notifUrl = notification.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE })

  // サービス間 URL を環境変数に追加
  const jwksUrl = cdk.Fn.join('', [authUrl.url, 'auth/.well-known/jwks.json'])
  addServiceUrls(feed, { AUTH_JWKS_URL: jwksUrl })
  addServiceUrls(notification, { AUTH_JWKS_URL: jwksUrl })
  addServiceUrls(authorizer, { AUTH_JWKS_URL: jwksUrl })

  return {
    auth,
    feed,
    notification,
    authorizer,
    urls: {
      auth: authUrl.url,
      feed: feedUrl.url,
      notification: notifUrl.url,
    },
  }
}

function createAuthFunction(
  scope: Construct,
  prefix: string,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'AuthFunction', {
    ...baseNodejsProps('auth', prefix, stage, 256),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
      GOOGLE_CLIENT_ID: ssm.values['google-client-id'],
      GOOGLE_CLIENT_SECRET: ssm.values['google-client-secret'],
      BETTER_AUTH_SECRET: ssm.values['better-auth-secret'],
      BETTER_AUTH_URL: ssm.values['better-auth-url'],
      WEB_ORIGIN: ssm.values['web-origin'],
      COOKIE_DOMAIN: ssm.values['cookie-domain'],
    },
  })
}

function createFeedFunction(
  scope: Construct,
  prefix: string,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'FeedFunction', {
    ...baseNodejsProps('feed', prefix, stage, 512),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
      WEB_ORIGIN: ssm.values['web-origin'],
    },
  })
}

function createNotificationFunction(
  scope: Construct,
  prefix: string,
  stage: string,
  ssm: SsmParams,
): NodejsFunction {
  return new NodejsFunction(scope, 'NotificationFunction', {
    ...baseNodejsProps('notification', prefix, stage, 256),
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
      DATABASE_URL: ssm.values['database-url'],
      WEB_ORIGIN: ssm.values['web-origin'],
    },
  })
}

function createAuthorizerFunction(
  scope: Construct,
  prefix: string,
  stage: string,
): NodejsFunction {
  return new NodejsFunction(scope, 'AuthorizerFunction', {
    functionName: `${prefix}-authorizer-${stage}`,
    entry: path.join(__dirname, '../functions/jwt-authorizer.ts'),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_22_X,
    memorySize: 128,
    timeout: cdk.Duration.seconds(10),
    logRetention: logs.RetentionDays.ONE_WEEK,
    bundling: {
      minify: true,
      sourceMap: true,
      target: 'node22',
      format: OutputFormat.ESM,
      banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    environment: {
      NODE_OPTIONS: '--enable-source-maps',
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
