import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { LambdaFunctionsResult } from './lambda-functions'

export interface ApiGatewayProps {
  readonly stage: string
  readonly prefix: string
  readonly lambdas: LambdaFunctionsResult
  readonly allowOrigins?: readonly string[]
  readonly customDomain?: string
  readonly certificateArn?: string
}

export interface ApiGatewayResult {
  readonly restApi: apigateway.RestApi
  readonly domainName?: apigateway.DomainName
}

/**
 * API Gateway REST API を作成し、各 Lambda にルーティングする
 * 認証が必要なルートには Lambda Authorizer を適用する
 */
export function createApiGateway(
  scope: Construct,
  props: ApiGatewayProps,
): ApiGatewayResult {
  const { stage, prefix, lambdas, allowOrigins = ['*'], customDomain, certificateArn } = props

  const restApi = new apigateway.RestApi(scope, 'RestApi', {
    restApiName: `${prefix}-api-${stage}`,
    deployOptions: {
      stageName: stage,
    },
    defaultCorsPreflightOptions: {
      allowOrigins: [...allowOrigins],
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      exposeHeaders: ['Set-Cookie', 'set-auth-jwt'],
      allowCredentials: true,
    },
  })

  // Lambda Authorizer
  const authorizer = new apigateway.RequestAuthorizer(scope, 'JwtAuthorizer', {
    handler: lambdas.authorizer,
    identitySources: [apigateway.IdentitySource.header('Authorization')],
    resultsCacheTtl: cdk.Duration.minutes(5),
    authorizerName: `${prefix}-jwt-authorizer-${stage}`,
  })

  // Lambda に API Gateway 全体の invoke 権限を一括付与（ポリシーサイズ上限回避）
  grantApiInvoke(restApi, lambdas.auth, 'AuthApiPermission')
  grantApiInvoke(restApi, lambdas.feed, 'FeedApiPermission')
  grantApiInvoke(restApi, lambdas.notification, 'NotificationApiPermission')

  const authIntegration = new apigateway.LambdaIntegration(lambdas.auth, {
    allowTestInvoke: false,
  })
  const feedIntegration = new apigateway.LambdaIntegration(lambdas.feed, {
    allowTestInvoke: false,
  })
  const notificationIntegration = new apigateway.LambdaIntegration(lambdas.notification, {
    allowTestInvoke: false,
  })

  // 認証不要: Auth routes
  const authResource = restApi.root.addResource('auth')
  authResource.addProxy({
    defaultIntegration: authIntegration,
    anyMethod: true,
  })

  // 認証不要: Health check
  const healthResource = restApi.root.addResource('health')
  healthResource.addMethod('GET', feedIntegration)

  // 認証必要: Feed routes（ANY + {proxy+} で統合）
  addProtectedProxy(restApi, 'feeds', feedIntegration, authorizer)
  addProtectedProxy(restApi, 'articles', feedIntegration, authorizer)
  addProtectedProxy(restApi, 'bookmarks', feedIntegration, authorizer)

  const settingsResource = restApi.root.addResource('settings')
  settingsResource.addMethod('ANY', feedIntegration, {
    authorizer,
    authorizationType: apigateway.AuthorizationType.CUSTOM,
  })

  // 認証必要: Notification routes
  addProtectedProxy(restApi, 'notifications', notificationIntegration, authorizer)

  // カスタムドメイン
  let domainName: apigateway.DomainName | undefined
  if (customDomain && certificateArn) {
    domainName = new apigateway.DomainName(scope, 'ApiDomainName', {
      domainName: customDomain,
      certificate: acm.Certificate.fromCertificateArn(scope, 'ApiCertificate', certificateArn),
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    })

    new apigateway.BasePathMapping(scope, 'ApiBasePathMapping', {
      domainName,
      restApi,
      stage: restApi.deploymentStage,
    })
  }

  return { restApi, domainName }
}

/**
 * Lambda に API Gateway 全体の invoke 権限を付与
 */
function grantApiInvoke(
  restApi: apigateway.RestApi,
  fn: lambda.IFunction,
  id: string,
): void {
  fn.addPermission(id, {
    principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
    sourceArn: restApi.arnForExecuteApi(),
  })
}

/**
 * 認証ありプロキシリソース: /path(ANY) と /path/{proxy+}(ANY) を登録
 */
function addProtectedProxy(
  restApi: apigateway.RestApi,
  path: string,
  integration: apigateway.LambdaIntegration,
  authorizer: apigateway.RequestAuthorizer,
): void {
  const resource = restApi.root.addResource(path)
  resource.addMethod('ANY', integration, {
    authorizer,
    authorizationType: apigateway.AuthorizationType.CUSTOM,
  })
  resource.addProxy({
    defaultIntegration: integration,
    anyMethod: false,
    defaultMethodOptions: {
      authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    },
  }).addMethod('ANY', integration, {
    authorizer,
    authorizationType: apigateway.AuthorizationType.CUSTOM,
  })
}
