const { GraphQLNonNull } = require('graphql')
const { t } = require('@lingui/macro')
const { Slug } = require('../../scalars')
const { organizationType } = require('../../types')

const findOrganizationBySlug = (i18n) => ({
  type: organizationType(i18n),
  description: i18n._(
    t`Select all information on a selected organization that a user has access to.`,
  ),
  args: {
    orgSlug: {
      type: GraphQLNonNull(Slug(i18n)),
      description: i18n._(
        t`The slugified organization name you want to retrieve data for.`,
      ),
    },
  },
  resolve: async (
    _,
    args,
    {
      i18n,
      auth: { checkPermission, userRequired },
      loaders: { orgLoaderBySlug },
      validators: { cleanseInput },
    },
  ) => {
    // Cleanse input
    const orgSlug = cleanseInput(args.orgSlug)

    // Get User
    const user = await userRequired()

    // Retrieve organization by slug
    const org = await orgLoaderBySlug.load(orgSlug)

    if (typeof org === 'undefined') {
      console.warn(`User ${user._key} could not retrieve organization.`)
      throw new Error(
        i18n._(t`No organization with the provided slug could be found.`),
      )
    }

    // Check user permission for organization access
    const permission = await checkPermission({ orgId: org._id })

    if (!['super_admin', 'admin', 'user'].includes(permission)) {
      console.warn(`User ${user._key} could not retrieve organization.`)
      throw new Error(i18n._(t`Could not retrieve specified organization.`))
    }

    console.info(
      `User ${user._key} successfully retrieved organization ${org._key}.`,
    )
    org.id = org._key
    return org
  },
})

module.exports = {
  findOrganizationBySlug,
}
