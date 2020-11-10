const DataLoader = require('dataloader')
const { t } = require('@lingui/macro')

module.exports.orgLoaderBySlug = (query, language, userId, i18n) =>
  new DataLoader(async (slugs) => {
    let cursor

    try {
      cursor = await query`
        FOR org IN organizations
          FILTER TRANSLATE(${language}, org.orgDetails).slug IN ${slugs}
          LET domains = (FOR v, e IN 1..1 OUTBOUND org._id claims RETURN e._to)
          RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev, blueCheck: org.blueCheck, domainCount: COUNT(domains) }, TRANSLATE(${language}, org.orgDetails))
      `
    } catch (err) {
      console.error(
        `Database error occurred when user: ${userId} running orgLoaderBySlug: ${err}`,
      )
      throw new Error(i18n._(t`Unable to find organization. Please try again.`))
    }

    const orgMap = {}
    try {
      await cursor.each((org) => {
        orgMap[org.slug] = org
      })
    } catch (err) {
      console.error(
        `Cursor error occurred when user: ${userId} running orgLoaderBySlug: ${err}`,
      )
      throw new Error(i18n._(t`Unable to find organization. Please try again.`))
    }

    return slugs.map((slug) => orgMap[slug])
  })
