const { GraphQLNonNull } = require('graphql')
const { t } = require('@lingui/macro')
const { Domain } = require('../../scalars')
const { domainType } = require('../../types')

const findDomainByDomain = (i18n) => ({
  type: domainType,
  description: i18n._(t`Retrieve a specific domain by providing a domain.`),
  args: {
    domain: {
      type: GraphQLNonNull(Domain(i18n)),
      description: i18n._(t`The domain you wish to retrieve information for.`),
    },
  },
  resolve: async (
    _,
    args,
    {
      i18n,
      auth: { checkDomainPermission, userRequired },
      loaders: { domainLoaderByDomain },
      validators: { cleanseInput },
    },
  ) => {
    // Cleanse input
    const domainInput = cleanseInput(args.domain)

    // Get User
    const user = await userRequired()

    // Retrieve domain by domain
    const domain = await domainLoaderByDomain.load(domainInput)

    if (typeof domain === 'undefined') {
      console.warn(`User ${user._key} could not retrieve domain.`)
      throw new Error(
        i18n._(t`No domain with the provided domain could be found.`),
      )
    }

    // Check user permission for domain access
    const permitted = await checkDomainPermission({ domainId: domain._id })

    if (!permitted) {
      console.warn(`User ${user._key} could not retrieve domain.`)
      throw new Error(i18n._(t`Could not retrieve specified domain.`))
    }

    console.info(
      `User ${user._key} successfully retrieved domain ${domain._key}.`,
    )
    domain.id = domain._key
    return domain
  },
})

module.exports = {
  findDomainByDomain,
}
