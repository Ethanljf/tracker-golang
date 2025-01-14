import cors from 'cors'
import express from 'express'
import http from 'http'
import { ApolloServer } from 'apollo-server-express'
import requestLanguage from 'express-request-language'
import { GraphQLSchema } from 'graphql'
import depthLimit from 'graphql-depth-limit'
import { createComplexityLimitRule } from 'graphql-validation-complexity'

import { createContext } from './create-context'
import { createQuerySchema } from './query'
import { createMutationSchema } from './mutation'
import { createSubscriptionSchema } from './subscription'
import { createI18n } from './create-i18n'
import { verifyToken, userRequired, verifiedRequired } from './auth'
import { loadUserByKey } from './user/loaders'
import { customOnConnect } from './on-connect'

const createSchema = () =>
  new GraphQLSchema({
    query: createQuerySchema(),
    mutation: createMutationSchema(),
    subscription: createSubscriptionSchema(),
  })

const createValidationRules = (
  maxDepth,
  complexityCost,
  scalarCost,
  objectCost,
  listFactor,
) => {
  return [
    depthLimit(maxDepth),
    createComplexityLimitRule(complexityCost, {
      scalarCost,
      objectCost,
      listFactor,
      formatErrorMessage: (cost) => {
        console.warn(`User attempted a costly request: ${cost}`)
        return `Query error, query is too complex.`
      },
    }),
  ]
}

export const Server = ({
  maxDepth,
  complexityCost,
  scalarCost,
  objectCost,
  listFactor,
  tracing,
  context = {},
}) => {
  const app = express()

  app.use('*', cors())

  app.use(
    requestLanguage({
      languages: ['en', 'fr'],
    }),
  )

  app.get('/alive', (_req, res) => {
    res.json({ ok: 'yes' })
  })

  app.get('/ready', (_req, res) => {
    res.json({ ok: 'yes' })
  })

  const server = new ApolloServer({
    schema: createSchema(),
    context: createContext(context),
    subscriptions: {
      onConnect: customOnConnect({
        context,
        createI18n,
        verifyToken,
        userRequired,
        loadUserByKey,
        verifiedRequired,
      }),
    },
    validationRules: createValidationRules(
      maxDepth,
      complexityCost,
      scalarCost,
      objectCost,
      listFactor,
    ),
    introspection: true,
    playground: true,
    tracing,
  })

  server.applyMiddleware({ app })

  const httpServer = http.createServer(app)

  server.installSubscriptionHandlers(httpServer)

  return httpServer
}
