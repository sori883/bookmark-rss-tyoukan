import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import type { Construct } from 'constructs'
import type { LambdaFunctionsResult } from './lambda-functions'

export interface ApiGatewayProps {
  readonly stage: string
  readonly lambdas: LambdaFunctionsResult
}

export interface ApiGatewayResult {
  readonly httpApi: apigwv2.HttpApi
}

/**
 * API Gateway HTTP API を作成し、各 Lambda にルーティングする
 */
export function createApiGateway(
  scope: Construct,
  props: ApiGatewayProps,
): ApiGatewayResult {
  const { stage, lambdas } = props

  const httpApi = new apigwv2.HttpApi(scope, 'HttpApi', {
    apiName: `bookmark-rss-api-${stage}`,
    corsPreflight: {
      allowOrigins: ['*'],
      allowMethods: [apigwv2.CorsHttpMethod.ANY],
      allowHeaders: ['Content-Type', 'Authorization'],
      allowCredentials: false,
    },
  })

  const authIntegration = new HttpLambdaIntegration(
    'AuthIntegration',
    lambdas.auth,
  )
  const bffIntegration = new HttpLambdaIntegration(
    'BffIntegration',
    lambdas.bff,
  )

  // Auth routes
  addRoute(httpApi, '/auth/{proxy+}', authIntegration)

  // BFF routes
  addRouteWithCollection(httpApi, '/feeds', bffIntegration)
  addRouteWithCollection(httpApi, '/articles', bffIntegration)
  addRouteWithCollection(httpApi, '/bookmarks', bffIntegration)
  addRouteWithCollection(httpApi, '/notifications', bffIntegration)
  addRoute(httpApi, '/settings', bffIntegration)

  // Health check
  httpApi.addRoutes({
    path: '/health',
    methods: [apigwv2.HttpMethod.GET],
    integration: bffIntegration,
  })

  return { httpApi }
}

/**
 * ANY メソッドでルートを追加する
 */
function addRoute(
  httpApi: apigwv2.HttpApi,
  path: string,
  integration: HttpLambdaIntegration,
): void {
  httpApi.addRoutes({
    path,
    methods: [
      apigwv2.HttpMethod.GET,
      apigwv2.HttpMethod.POST,
      apigwv2.HttpMethod.PUT,
      apigwv2.HttpMethod.DELETE,
      apigwv2.HttpMethod.PATCH,
    ],
    integration,
  })
}

/**
 * コレクションルート: /path と /path/{proxy+} の両方を登録する
 */
function addRouteWithCollection(
  httpApi: apigwv2.HttpApi,
  basePath: string,
  integration: HttpLambdaIntegration,
): void {
  addRoute(httpApi, basePath, integration)
  addRoute(httpApi, `${basePath}/{proxy+}`, integration)
}
