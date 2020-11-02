const { GraphQLNonNull, GraphQLString, GraphQLInt } = require('graphql')
const { mutationWithClientMutationId } = require('graphql-relay')
const { t } = require('@lingui/macro')
const { authResultType } = require('../../types')

const { SIGN_IN_KEY } = process.env

const authenticate = (i18n) =>
  new mutationWithClientMutationId({
    name: 'Authenticate',
    description: i18n._(
      t`This mutation allows users to give their credentials and retrieve a token that gives them access to restricted content.`,
    ),
    inputFields: () => ({
      authenticationCode: {
        type: GraphQLNonNull(GraphQLInt),
        description: i18n._(
          t`Security code found in text msg, or email inbox.`,
        ),
      },
      authenticateToken: {
        type: GraphQLNonNull(GraphQLString),
        description: i18n._(
          t`The JWT that is retrieved from the sign in mutation.`,
        ),
      },
    }),
    outputFields: () => ({
      authResult: {
        type: authResultType,
        description: i18n._(t`The authenticated users information, and JWT.`),
        resolve: async (payload) => {
          return payload.authResult
        },
      },
    }),
    mutateAndGetPayload: async (
      args,
      {
        i18n,
        query,
        auth: { tokenize, verifyToken },
        loaders: { userLoaderByKey },
        validators: { cleanseInput },
      },
    ) => {
      // Cleanse Inputs
      const authenticationCode = args.authenticationCode
      const authenticationToken = cleanseInput(args.authenticateToken)

      // Gather token parameters
      const tokenParameters = verifyToken({
        token: authenticationToken,
        secret: String(SIGN_IN_KEY),
      })

      if (
        tokenParameters.userId === 'undefined' ||
        typeof tokenParameters.userId === 'undefined'
      ) {
        console.warn(`Authentication token does not contain the userId`)
        throw new Error(i18n._(t`Unable to authenticate. Please try again.`))
      }

      // Gather sign in user
      const user = await userLoaderByKey.load(tokenParameters.userId)

      if (typeof user === 'undefined') {
        console.warn(
          `User: ${tokenParameters.userId} attempted to authenticate, no account is associated with this id.`,
        )
        throw new Error(i18n._(t`Unable to authenticate. Please try again.`))
      }

      // Check to see if security token matches the user submitted one
      if (authenticationCode === user.tfaCode) {
        const token = tokenize({ parameters: { userId: user._key } })

        // Reset Failed Login attempts
        try {
          await query`
                FOR u IN users
                  UPDATE ${user._key} WITH { tfaCode: null } IN users
              `
        } catch (err) {
          console.error(
            `Database error ocurred when resetting failed attempts for user: ${user._key} during authentication: ${err}`,
          )
          throw new Error(i18n._(t`Unable to authenticate. Please try again.`))
        }

        console.info(
          `User: ${user._key} successfully authenticated their account.`,
        )
        user.id = user._key

        return {
          authResult: {
            token,
            user,
          },
        }
      } else {
        console.warn(
          `User: ${user._key} attempted to authenticate their account, however the tfaCodes did not match.`,
        )
        throw new Error(i18n._(t`Unable to authenticate. Please try again.`))
      }
    },
  })

module.exports = {
  authenticate,
}
