const {
  domainLoaderByKey,
  domainLoaderBySlug,
  domainLoaderConnectionsByOrgId,
} = require('./domains')
const {
  orgLoaderByKey,
  orgLoaderBySlug,
  orgLoaderByConnectionArgs,
  orgLoaderConnectionArgsByDomainId,
} = require('./organizations')
const { userLoaderByUserName, userLoaderByKey } = require('./user')

module.exports = {
  // Domain Loaders
  domainLoaderByKey,
  domainLoaderBySlug,
  domainLoaderConnectionsByOrgId,
  // Org Loaders
  orgLoaderByKey,
  orgLoaderBySlug,
  orgLoaderByConnectionArgs,
  orgLoaderConnectionArgsByDomainId,
  // User Loaders
  userLoaderByUserName,
  userLoaderByKey,
}