import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from 'aws-cdk-lib/aws-apigatewayv2-authorizers'
import * as cdk from 'aws-cdk-lib'
import type { Construct } from 'constructs'
import type { LambdaFunctionsResult } from './lambda-functions'

export interface ApiGatewayProps {
  readonly stage: string
  readonly prefix: string
  readonly lambdas: LambdaFunctionsResult
  readonly allowOrigins?: readonly string[]
}

export interface ApiGatewayResult {
  readonly httpApi: apigwv2.HttpApi
}

/**
 * API Gateway HTTP API を作成し、各 Lambda にルーティングする
 * 認証が必要なルートには Lambda Authorizer を適用する
 */
export function createApiGateway(
  scope: Construct,
  props: ApiGatewayProps,
): ApiGatewayResult {
  const { stage, prefix, lambdas, allowOrigins = ['*'] } = props

  const httpApi = new apigwv2.HttpApi(scope, 'HttpApi', {
    apiName: `${prefix}-api-${stage}`,
    corsPreflight: {
      allowOrigins: [...allowOrigins],
      allowMethods: [apigwv2.CorsHttpMethod.ANY],
      allowHeaders: ['Content-Type', 'Authorization'],
      allowCredentials: allowOrigins.includes('*') ? false : true,
    },
  })

  // Lambda Authorizer
  const authorizer = new HttpLambdaAuthorizer(
    'JwtAuthorizer',
    lambdas.authorizer,
    {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      resultsCacheTtl: cdk.Duration.minutes(5),
    },
  )

  const authIntegration = new HttpLambdaIntegration(
    'AuthIntegration',
    lambdas.auth,
  )
  const feedIntegration = new HttpLambdaIntegration(
    'FeedIntegration',
    lambdas.feed,
  )
  const notificationIntegration = new HttpLambdaIntegration(
    'NotificationIntegration',
    lambdas.notification,
  )

  // 認証不要: Auth routes
  addRoute(httpApi, '/auth/{proxy+}', authIntegration)

  // 認証不要: Health check
  httpApi.addRoutes({
    path: '/health',
    methods: [apigwv2.HttpMethod.GET],
    integration: feedIntegration,
  })

  // 認証必要: Feed routes
  addProtectedRouteWithCollection(httpApi, '/feeds', feedIntegration, authorizer)
  addProtectedRouteWithCollection(httpApi, '/articles', feedIntegration, authorizer)
  addProtectedRouteWithCollection(httpApi, '/bookmarks', feedIntegration, authorizer)
  addProtectedRoute(httpApi, '/settings', feedIntegration, authorizer)

  // 認証必要: Notification routes
  addProtectedRouteWithCollection(httpApi, '/notifications', notificationIntegration, authorizer)

  return { httpApi }
}

const ALL_METHODS = [
  apigwv2.HttpMethod.GET,
  apigwv2.HttpMethod.POST,
  apigwv2.HttpMethod.PUT,
  apigwv2.HttpMethod.DELETE,
  apigwv2.HttpMethod.PATCH,
]

/**
 * 認証なしルート
 */
function addRoute(
  httpApi: apigwv2.HttpApi,
  path: string,
  integration: HttpLambdaIntegration,
): void {
  httpApi.addRoutes({
    path,
    methods: ALL_METHODS,
    integration,
  })
}

/**
 * 認証ありルート
 */
function addProtectedRoute(
  httpApi: apigwv2.HttpApi,
  path: string,
  integration: HttpLambdaIntegration,
  authorizer: HttpLambdaAuthorizer,
): void {
  httpApi.addRoutes({
    path,
    methods: ALL_METHODS,
    integration,
    authorizer,
  })
}

/**
 * 認証ありコレクションルート: /path と /path/{proxy+} の両方を登録する
 */
function addProtectedRouteWithCollection(
  httpApi: apigwv2.HttpApi,
  basePath: string,
  integration: HttpLambdaIntegration,
  authorizer: HttpLambdaAuthorizer,
): void {
  addProtectedRoute(httpApi, basePath, integration, authorizer)
  addProtectedRoute(httpApi, `${basePath}/{proxy+}`, integration, authorizer)
}
