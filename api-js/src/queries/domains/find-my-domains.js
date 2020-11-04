const { connectionArgs } = require('graphql-relay')
const { t } = require('@lingui/macro')
const { domainConnection } = require('../../types')

const findMyDomains = (i18n) => ({
  type: domainConnection.connectionType,
  description: i18n._(t`Select domains a user has access to.`),
  args: {
    ...connectionArgs,
  },
  resolve: async (
    _,
    args,
    { i18n, userId, loaders: { domainLoaderConnectionsByUserId } },
  ) => {
    let domainConnections

    try {
      domainConnections = await domainLoaderConnectionsByUserId(args)
    } catch (err) {
      console.error(
        `Database error occurred while user: ${userId} was trying to gather domain connections in findMyDomains.`,
      )
      throw new Error(i18n._(t`Unable to load domains. Please try again.`))
    }

    console.info(`User ${userId} successfully retrieved their domains.`)

    return domainConnections
  },
})

module.exports = {
  findMyDomains,
}
