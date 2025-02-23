import { t } from '@lingui/macro'
import { aql } from 'arangojs'
import { fromGlobalId, toGlobalId } from 'graphql-relay'

export const loadAggregateGuidanceTagConnectionsByTagId = ({
  query,
  userKey,
  cleanseInput,
  i18n,
}) => async ({
  aggregateGuidanceTags,
  after,
  before,
  first,
  last,
  orderBy,
}) => {
  let afterTemplate = aql``
  if (typeof after !== 'undefined') {
    const { id: afterId } = fromGlobalId(cleanseInput(after))
    if (typeof orderBy === 'undefined') {
      afterTemplate = aql`FILTER TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) > TO_NUMBER(REGEX_SPLIT(${afterId}, "[a-z]+")[1])`
    } else {
      let afterTemplateDirection = aql`<`
      if (orderBy.direction === 'ASC') {
        afterTemplateDirection = aql`>`
      }

      let tagField, documentField
      /* istanbul ignore else */
      if (orderBy.field === 'tag-id') {
        tagField = aql`tag._key`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${afterId})._key`
      } else if (orderBy.field === 'tag-name') {
        tagField = aql`tag.tagName`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${afterId}).tagName`
      } else if (orderBy.field === 'guidance') {
        tagField = aql`tag.guidance`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${afterId}).guidance`
      }

      afterTemplate = aql`
        FILTER ${tagField} ${afterTemplateDirection} ${documentField}
        OR (${tagField} == ${documentField}
        AND TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) > TO_NUMBER(REGEX_SPLIT(${afterId}, "[a-z]+")[1]))
      `
    }
  }

  let beforeTemplate = aql``
  if (typeof before !== 'undefined') {
    const { id: beforeId } = fromGlobalId(cleanseInput(before))
    if (typeof orderBy === 'undefined') {
      beforeTemplate = aql`FILTER TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) < TO_NUMBER(REGEX_SPLIT(${beforeId}, "[a-z]+")[1])`
    } else {
      let beforeTemplateDirection = aql`>`
      if (orderBy.direction === 'ASC') {
        beforeTemplateDirection = aql`<`
      }

      let tagField, documentField
      /* istanbul ignore else */
      if (orderBy.field === 'tag-id') {
        tagField = aql`tag._key`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${beforeId})._key`
      } else if (orderBy.field === 'tag-name') {
        tagField = aql`tag.tagName`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${beforeId}).tagName`
      } else if (orderBy.field === 'guidance') {
        tagField = aql`tag.guidance`
        documentField = aql`DOCUMENT(aggregateGuidanceTags, ${beforeId}).guidance`
      }

      beforeTemplate = aql`
        FILTER ${tagField} ${beforeTemplateDirection} ${documentField}
        OR (${tagField} == ${documentField}
        AND TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) < TO_NUMBER(REGEX_SPLIT(${beforeId}, "[a-z]+")[1]))
      `
    }
  }

  let limitTemplate = aql``
  if (typeof first === 'undefined' && typeof last === 'undefined') {
    console.warn(
      `User: ${userKey} did not have either \`first\` or \`last\` arguments set for: loadAggregateGuidanceTagConnectionsByTagId.`,
    )
    throw new Error(
      i18n._(
        t`You must provide a \`first\` or \`last\` value to properly paginate the \`GuidanceTag\` connection.`,
      ),
    )
  } else if (typeof first !== 'undefined' && typeof last !== 'undefined') {
    console.warn(
      `User: ${userKey} attempted to have \`first\` and \`last\` arguments set for: loadAggregateGuidanceTagConnectionsByTagId.`,
    )
    throw new Error(
      i18n._(
        t`Passing both \`first\` and \`last\` to paginate the \`GuidanceTag\` connection is not supported.`,
      ),
    )
  } else if (typeof first === 'number' || typeof last === 'number') {
    /* istanbul ignore else */
    if (first < 0 || last < 0) {
      const argSet = typeof first !== 'undefined' ? 'first' : 'last'
      console.warn(
        `User: ${userKey} attempted to have \`${argSet}\` set below zero for: loadAggregateGuidanceTagConnectionsByTagId.`,
      )
      throw new Error(
        i18n._(
          t`\`${argSet}\` on the \`GuidanceTag\` connection cannot be less than zero.`,
        ),
      )
    } else if (first > 100 || last > 100) {
      const argSet = typeof first !== 'undefined' ? 'first' : 'last'
      const amount = typeof first !== 'undefined' ? first : last
      console.warn(
        `User: ${userKey} attempted to have \`${argSet}\` set to ${amount} for: loadAggregateGuidanceTagConnectionsByTagId.`,
      )
      throw new Error(
        i18n._(
          t`Requesting \`${amount}\` records on the \`GuidanceTag\` connection exceeds the \`${argSet}\` limit of 100 records.`,
        ),
      )
    } else if (typeof first !== 'undefined' && typeof last === 'undefined') {
      limitTemplate = aql`TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) ASC LIMIT TO_NUMBER(${first})`
    } else if (typeof first === 'undefined' && typeof last !== 'undefined') {
      limitTemplate = aql`TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) DESC LIMIT TO_NUMBER(${last})`
    }
  } else {
    const argSet = typeof first !== 'undefined' ? 'first' : 'last'
    const typeSet = typeof first !== 'undefined' ? typeof first : typeof last
    console.warn(
      `User: ${userKey} attempted to have \`${argSet}\` set as a ${typeSet} for: loadAggregateGuidanceTagConnectionsByTagId.`,
    )
    throw new Error(
      i18n._(t`\`${argSet}\` must be of type \`number\` not \`${typeSet}\`.`),
    )
  }

  let hasNextPageFilter = aql`FILTER TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) > TO_NUMBER(REGEX_SPLIT(LAST(retrievedAggregateGuidanceTags)._key, "[a-z]+")[1])`
  let hasPreviousPageFilter = aql`FILTER TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) < TO_NUMBER(REGEX_SPLIT(FIRST(retrievedAggregateGuidanceTags)._key, "[a-z]+")[1])`

  if (typeof orderBy !== 'undefined') {
    let hasNextPageDirection = aql`<`
    let hasPreviousPageDirection = aql`>`
    if (orderBy.direction === 'ASC') {
      hasNextPageDirection = aql`>`
      hasPreviousPageDirection = aql`<`
    }

    let tagField, hasNextPageDocument, hasPreviousPageDocument
    /* istanbul ignore else */
    if (orderBy.field === 'tag-id') {
      tagField = aql`tag._key`
      hasNextPageDocument = aql`LAST(retrievedAggregateGuidanceTags)._key`
      hasPreviousPageDocument = aql`FIRST(retrievedAggregateGuidanceTags)._key`
    } else if (orderBy.field === 'tag-name') {
      tagField = aql`tag.tagName`
      hasNextPageDocument = aql`LAST(retrievedAggregateGuidanceTags).tagName`
      hasPreviousPageDocument = aql`FIRST(retrievedAggregateGuidanceTags).tagName`
    } else if (orderBy.field === 'guidance') {
      tagField = aql`tag.guidance`
      hasNextPageDocument = aql`LAST(retrievedAggregateGuidanceTags).guidance`
      hasPreviousPageDocument = aql`FIRST(retrievedAggregateGuidanceTags).guidance`
    }

    hasNextPageFilter = aql`
      FILTER ${tagField} ${hasNextPageDirection} ${hasNextPageDocument}
      OR (${tagField} == ${hasNextPageDocument}
      AND TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) > TO_NUMBER(REGEX_SPLIT(LAST(retrievedAggregateGuidanceTags)._key, "[a-z]+")[1]))
    `

    hasPreviousPageFilter = aql`
      FILTER ${tagField} ${hasPreviousPageDirection} ${hasPreviousPageDocument}
      OR (${tagField} == ${hasPreviousPageDocument}
      AND TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) < TO_NUMBER(REGEX_SPLIT(FIRST(retrievedAggregateGuidanceTags)._key, "[a-z]+")[1]))
    `
  }

  let sortByField = aql``
  if (typeof orderBy !== 'undefined') {
    /* istanbul ignore else */
    if (orderBy.field === 'tag-id') {
      sortByField = aql`tag._key ${orderBy.direction},`
    } else if (orderBy.field === 'tag-name') {
      sortByField = aql`tag.tagName ${orderBy.direction},`
    } else if (orderBy.field === 'guidance') {
      sortByField = aql`tag.guidance ${orderBy.direction},`
    }
  }

  let sortString
  if (typeof last !== 'undefined') {
    sortString = aql`DESC`
  } else {
    sortString = aql`ASC`
  }

  let aggregateGuidanceTagInfoCursor
  try {
    aggregateGuidanceTagInfoCursor = await query`
      WITH aggregateGuidanceTags
      LET retrievedAggregateGuidanceTags = (
        FOR tag IN aggregateGuidanceTags
          FILTER tag._key IN ${aggregateGuidanceTags}
          ${afterTemplate}
          ${beforeTemplate}
          SORT
          ${sortByField}
          ${limitTemplate}
          RETURN MERGE(tag, { tagId: tag._key, id: tag._key, _type: "guidanceTag" })
      )

      LET hasNextPage = (LENGTH(
        FOR tag IN aggregateGuidanceTags
          FILTER tag._key IN ${aggregateGuidanceTags}
          ${hasNextPageFilter}
          SORT ${sortByField} TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) ${sortString} LIMIT 1
          RETURN tag
      ) > 0 ? true : false)

      LET hasPreviousPage = (LENGTH(
        FOR tag IN aggregateGuidanceTags
          FILTER tag._key IN ${aggregateGuidanceTags}
          ${hasPreviousPageFilter}
          SORT ${sortByField} TO_NUMBER(REGEX_SPLIT(tag._key, "[a-z]+")[1]) ${sortString} LIMIT 1
          RETURN tag
      ) > 0 ? true : false)
      
      RETURN {
        "aggregateGuidanceTags": retrievedAggregateGuidanceTags,
        "totalCount": LENGTH(${aggregateGuidanceTags}),
        "hasNextPage": hasNextPage,
        "hasPreviousPage": hasPreviousPage,
        "startKey": FIRST(retrievedAggregateGuidanceTags)._key,
        "endKey": LAST(retrievedAggregateGuidanceTags)._key
      }
    `
  } catch (err) {
    console.error(
      `Database error occurred while user: ${userKey} was trying to gather tags in loadAggregateGuidanceTagConnectionsByTagId, error: ${err}`,
    )
    throw new Error(
      i18n._(t`Unable to load Aggregate guidance tag(s). Please try again.`),
    )
  }

  let aggregateGuidanceTagInfo
  try {
    aggregateGuidanceTagInfo = await aggregateGuidanceTagInfoCursor.next()
  } catch (err) {
    console.error(
      `Cursor error occurred while user: ${userKey} was trying to gather tags in loadAggregateGuidanceTagConnectionsByTagId, error: ${err}`,
    )
    throw new Error(
      i18n._(t`Unable to load Aggregate guidance tag(s). Please try again.`),
    )
  }

  if (aggregateGuidanceTagInfo.aggregateGuidanceTags.length === 0) {
    return {
      edges: [],
      totalCount: 0,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: '',
        endCursor: '',
      },
    }
  }

  const edges = aggregateGuidanceTagInfo.aggregateGuidanceTags.map((tag) => ({
    cursor: toGlobalId('guidanceTags', tag._key),
    node: tag,
  }))

  return {
    edges,
    totalCount: aggregateGuidanceTagInfo.totalCount,
    pageInfo: {
      hasNextPage: aggregateGuidanceTagInfo.hasNextPage,
      hasPreviousPage: aggregateGuidanceTagInfo.hasPreviousPage,
      startCursor: toGlobalId(
        'guidanceTags',
        aggregateGuidanceTagInfo.startKey,
      ),
      endCursor: toGlobalId('guidanceTags', aggregateGuidanceTagInfo.endKey),
    },
  }
}
