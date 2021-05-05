import { ensure, dbNameFromFile } from 'arango-tools'
import { setupI18n } from '@lingui/core'

import englishMessages from '../../../locale/en/messages'
import frenchMessages from '../../../locale/fr/messages'
import { databaseOptions } from '../../../../database-options'
import { loadAggregateGuidanceTagById } from '../index'

const { DB_PASS: rootPass, DB_URL: url } = process.env

describe('given the loadAggregateGuidanceTagById function', () => {
  let query, drop, truncate, collections, i18n

  const consoleErrorOutput = []
  const mockedError = (output) => consoleErrorOutput.push(output)

  beforeAll(async () => {
    ;({ query, drop, truncate, collections } = await ensure({
      type: 'database',
      name: dbNameFromFile(__filename),
      url,
      rootPassword: rootPass,
      options: databaseOptions({ rootPass }),
    }))
    console.error = mockedError
    i18n = setupI18n({
      locale: 'en',
      localeData: {
        en: { plurals: {} },
        fr: { plurals: {} },
      },
      locales: ['en', 'fr'],
      messages: {
        en: englishMessages.messages,
        fr: frenchMessages.messages,
      },
    })
  })

  beforeEach(async () => {
    consoleErrorOutput.length = 0

    await truncate()
    await collections.aggregateGuidanceTags.save({
      _key: 'agg1',
      en: {
        tagName: 'Some Cool Tag Name A',
        guidance: 'Some Cool Guidance A',
        refLinksGuide: [
          {
            description: 'IT PIN A',
          },
        ],
        refLinksTechnical: [''],
      },
      fr: {
        tagName: 'todo a',
        guidance: 'todo a',
        refLinksGuide: [
          {
            description: 'todo a',
          },
        ],
        refLinksTechnical: [''],
      },
    })
    await collections.aggregateGuidanceTags.save({
      _key: 'agg2',
      en: {
        tagName: 'Some Cool Tag Name B',
        guidance: 'Some Cool Guidance B',
        refLinksGuide: [
          {
            description: 'IT PIN B',
          },
        ],
        refLinksTechnical: [''],
      },
      fr: {
        tagName: 'todo b',
        guidance: 'todo b',
        refLinksGuide: [
          {
            description: 'todo b',
          },
        ],
        refLinksTechnical: [''],
      },
    })
  })

  afterAll(async () => {
    await drop()
  })

  describe('users language is set to english', () => {
    beforeAll(() => {
      i18n = setupI18n({
        locale: 'en',
        localeData: {
          en: { plurals: {} },
          fr: { plurals: {} },
        },
        locales: ['en', 'fr'],
        messages: {
          en: englishMessages.messages,
          fr: frenchMessages.messages,
        },
      })
    })
    describe('given a successful load', () => {
      describe('given a single id', () => {
        it('returns a single aggregate guidance tag', async () => {
          const expectedCursor = await query`
            FOR tag IN aggregateGuidanceTags
              SORT tag._key ASC LIMIT 1
              RETURN MERGE(
                {
                  _id: tag._id,
                  _key: tag._key,
                  _rev: tag._rev,
                  _type: "guidanceTag",
                  id: tag._key,
                  tagId: tag._key
                },
                TRANSLATE("en", tag)
              )
          `
          const expectedAggregateTag = await expectedCursor.next()

          const loader = loadAggregateGuidanceTagById({
            query,
            i18n,
            language: 'en',
          })
          const aggregateTag = await loader.load(expectedAggregateTag._key)

          expect(aggregateTag).toEqual(expectedAggregateTag)
        })
      })
      describe('given multiple ids', () => {
        it('returns multiple aggregate guidance tags', async () => {
          const aggregateTagKeys = []
          const expectedAggregateTags = []
          const expectedCursor = await query`
            FOR tag IN aggregateGuidanceTags
              RETURN MERGE(
                {
                  _id: tag._id,
                  _key: tag._key,
                  _rev: tag._rev,
                  _type: "guidanceTag",
                  id: tag._key,
                  tagId: tag._key
                },
                TRANSLATE("en", tag)
              )
          `

          while (expectedCursor.hasMore) {
            const tempAggregate = await expectedCursor.next()
            aggregateTagKeys.push(tempAggregate._key)
            expectedAggregateTags.push(tempAggregate)
          }

          const loader = loadAggregateGuidanceTagById({
            query,
            i18n,
            language: 'en',
          })
          const aggregateTags = await loader.loadMany(aggregateTagKeys)
          expect(aggregateTags).toEqual(expectedAggregateTags)
        })
      })
    })
    describe('given a database error', () => {
      it('raises an error', async () => {
        const mockedQuery = jest
          .fn()
          .mockRejectedValue(new Error('Database error occurred.'))
        const loader = loadAggregateGuidanceTagById({
          query: mockedQuery,
          userKey: '1234',
          i18n,
        })

        try {
          await loader.load('1')
        } catch (err) {
          expect(err).toEqual(
            new Error(
              'Unable to find Aggregate guidance tag(s). Please try again.',
            ),
          )
        }

        expect(consoleErrorOutput).toEqual([
          `Database error occurred when user: 1234 running loadAggregateGuidanceTagById: Error: Database error occurred.`,
        ])
      })
    })
    describe('given a cursor error', () => {
      it('raises an error', async () => {
        const cursor = {
          forEach() {
            throw new Error('Cursor error occurred.')
          },
        }
        const mockedQuery = jest.fn().mockReturnValue(cursor)
        const loader = loadAggregateGuidanceTagById({
          query: mockedQuery,
          userKey: '1234',
          i18n,
        })

        try {
          await loader.load('1')
        } catch (err) {
          expect(err).toEqual(
            new Error(
              'Unable to find Aggregate guidance tag(s). Please try again.',
            ),
          )
        }

        expect(consoleErrorOutput).toEqual([
          `Cursor error occurred when user: 1234 running loadAggregateGuidanceTagById: Error: Cursor error occurred.`,
        ])
      })
    })
  })
  describe('users language is set to french', () => {
    beforeAll(() => {
      i18n = setupI18n({
        locale: 'fr',
        localeData: {
          en: { plurals: {} },
          fr: { plurals: {} },
        },
        locales: ['en', 'fr'],
        messages: {
          en: englishMessages.messages,
          fr: frenchMessages.messages,
        },
      })
    })
    describe('given a successful load', () => {
      describe('given a single id', () => {
        it('returns a single aggregate guidance tag', async () => {
          const expectedCursor = await query`
            FOR tag IN aggregateGuidanceTags
              SORT tag._key ASC LIMIT 1
              RETURN MERGE(
                {
                  _id: tag._id,
                  _key: tag._key,
                  _rev: tag._rev,
                  _type: "guidanceTag",
                  id: tag._key,
                  tagId: tag._key
                },
                TRANSLATE("fr", tag)
              )
          `
          console.log(expectedCursor)
          const expectedAggregateTag = await expectedCursor.next()

          const loader = loadAggregateGuidanceTagById({
            query,
            i18n,
            language: 'fr',
          })
          const aggregateTag = await loader.load(expectedAggregateTag._key)

          expect(aggregateTag).toEqual(expectedAggregateTag)
        })
      })
      describe('given multiple ids', () => {
        it('returns multiple aggregate guidance tags', async () => {
          const aggregateTagKeys = []
          const expectedAggregateTags = []
          const expectedCursor = await query`
            FOR tag IN aggregateGuidanceTags
              RETURN MERGE(
                {
                  _id: tag._id,
                  _key: tag._key,
                  _rev: tag._rev,
                  _type: "guidanceTag",
                  id: tag._key,
                  tagId: tag._key
                },
                TRANSLATE("fr", tag)
              )
          `

          while (expectedCursor.hasMore) {
            const tempAggregate = await expectedCursor.next()
            aggregateTagKeys.push(tempAggregate._key)
            expectedAggregateTags.push(tempAggregate)
          }

          const loader = loadAggregateGuidanceTagById({
            query,
            i18n,
            language: 'fr',
          })
          const aggregateTags = await loader.loadMany(aggregateTagKeys)
          expect(aggregateTags).toEqual(expectedAggregateTags)
        })
      })
    })
    describe('given a database error', () => {
      it('raises an error', async () => {
        const mockedQuery = jest
          .fn()
          .mockRejectedValue(new Error('Database error occurred.'))
        const loader = loadAggregateGuidanceTagById({
          query: mockedQuery,
          userKey: '1234',
          i18n,
        })

        try {
          await loader.load('1')
        } catch (err) {
          expect(err).toEqual(new Error('todo'))
        }

        expect(consoleErrorOutput).toEqual([
          `Database error occurred when user: 1234 running loadAggregateGuidanceTagById: Error: Database error occurred.`,
        ])
      })
    })
    describe('given a cursor error', () => {
      it('raises an error', async () => {
        const cursor = {
          forEach() {
            throw new Error('Cursor error occurred.')
          },
        }
        const mockedQuery = jest.fn().mockReturnValue(cursor)
        const loader = loadAggregateGuidanceTagById({
          query: mockedQuery,
          userKey: '1234',
          i18n,
        })

        try {
          await loader.load('1')
        } catch (err) {
          expect(err).toEqual(new Error('todo'))
        }

        expect(consoleErrorOutput).toEqual([
          `Cursor error occurred when user: 1234 running loadAggregateGuidanceTagById: Error: Cursor error occurred.`,
        ])
      })
    })
  })
})
