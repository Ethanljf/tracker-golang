import { stringify } from 'jest-matcher-utils'
import { ensure, dbNameFromFile } from 'arango-tools'
import { toGlobalId } from 'graphql-relay'
import { setupI18n } from '@lingui/core'

import englishMessages from '../../../locale/en/messages'
import frenchMessages from '../../../locale/fr/messages'
import { databaseOptions } from '../../../../database-options'
import { cleanseInput } from '../../../validators'
import {
  loadDmarcSummaryConnectionsByUserId,
  loadDmarcSummaryByKey,
} from '../index'

const { DB_PASS: rootPass, DB_URL: url } = process.env

describe('given the loadDmarcSummaryConnectionsByUserId function', () => {
  let query,
    drop,
    truncate,
    collections,
    org,
    i18n,
    user,
    domain1,
    domain2,
    dmarcSummary1,
    dmarcSummary2

  const consoleOutput = []
  const mockedError = (output) => consoleOutput.push(output)
  const mockedWarn = (output) => consoleOutput.push(output)

  beforeAll(async () => {
    console.error = mockedError
    console.warn = mockedWarn
    ;({ query, drop, truncate, collections } = await ensure({
      type: 'database',
      name: dbNameFromFile(__filename),
      url,
      rootPassword: rootPass,
      options: databaseOptions({ rootPass }),
    }))
  })

  beforeEach(async () => {
    await truncate()
    user = await collections.users.save({
      userName: 'test.account@istio.actually.exists',
      displayName: 'Test Account',
      preferredLang: 'french',
      tfaValidated: false,
      emailValidated: false,
    })
    org = await collections.organizations.save({
      orgDetails: {
        en: {
          slug: 'treasury-board-secretariat',
          acronym: 'TBS',
          name: 'Treasury Board of Canada Secretariat',
          zone: 'FED',
          sector: 'TBS',
          country: 'Canada',
          province: 'Ontario',
          city: 'Ottawa',
        },
        fr: {
          slug: 'secretariat-conseil-tresor',
          acronym: 'SCT',
          name: 'Secrétariat du Conseil Trésor du Canada',
          zone: 'FED',
          sector: 'TBS',
          country: 'Canada',
          province: 'Ontario',
          city: 'Ottawa',
        },
      },
    })
    await collections.affiliations.save({
      _from: org._id,
      _to: user._id,
      permission: 'user',
    })
    domain1 = await collections.domains.save({
      domain: 'test1.gc.ca',
      lastRan: null,
      selectors: ['selector1._domainkey', 'selector2._domainkey'],
    })
    await collections.ownership.save({
      _to: domain1._id,
      _from: org._id,
    })
    domain2 = await collections.domains.save({
      domain: 'test2.gc.ca',
      lastRan: null,
      selectors: ['selector1._domainkey', 'selector2._domainkey'],
    })
    await collections.ownership.save({
      _to: domain2._id,
      _from: org._id,
    })
    dmarcSummary1 = await collections.dmarcSummaries.save({
      detailTables: {
        dkimFailure: [],
        dmarcFailure: [],
        fullPass: [],
        spfFailure: [],
      },
      categoryTotals: {
        pass: 1,
        fail: 1,
        passDkimOnly: 1,
        passSpfOnly: 1,
      },
      categoryPercentages: {
        pass: 1,
        fail: 1,
        passDkimOnly: 1,
        passSpfOnly: 1,
      },
      totalMessages: 4,
    })
    dmarcSummary2 = await collections.dmarcSummaries.save({
      detailTables: {
        dkimFailure: [],
        dmarcFailure: [],
        fullPass: [],
        spfFailure: [],
      },
      categoryTotals: {
        pass: 2,
        fail: 2,
        passDkimOnly: 2,
        passSpfOnly: 2,
      },
      categoryPercentages: {
        pass: 2,
        fail: 2,
        passDkimOnly: 2,
        passSpfOnly: 2,
      },
      totalMessages: 8,
    })
    await collections.domainsToDmarcSummaries.save({
      _from: domain1._id,
      _to: dmarcSummary1._id,
      startDate: 'thirtyDays',
    })
    await collections.domainsToDmarcSummaries.save({
      _from: domain2._id,
      _to: dmarcSummary2._id,
      startDate: 'thirtyDays',
    })
    consoleOutput.length = 0
  })

  afterEach(async () => {
    await truncate()
  })

  afterAll(async () => {
    await drop()
  })

  describe('given there are dmarc summary connections to be returned', () => {
    describe('using after cursor', () => {
      it('returns a dmarc summary', async () => {
        const expectedSummaries = await loadDmarcSummaryByKey({
          query,
        }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          first: 10,
          period: 'thirtyDays',
          year: '2021',
          after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
              node: {
                ...expectedSummaries[1],
              },
            },
          ],
          totalCount: 2,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: true,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[1]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
    describe('using before cursor', () => {
      it('returns a dmarc summary', async () => {
        const expectedSummaries = await loadDmarcSummaryByKey({
          query,
        }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          first: 10,
          period: 'thirtyDays',
          year: '2021',
          before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
              node: {
                ...expectedSummaries[0],
              },
            },
          ],
          totalCount: 2,
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[0]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
    describe('using first limit', () => {
      it('returns a dmarc summary', async () => {
        const expectedSummaries = await loadDmarcSummaryByKey({
          query,
        }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          first: 1,
          period: 'thirtyDays',
          year: '2021',
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
              node: {
                ...expectedSummaries[0],
              },
            },
          ],
          totalCount: 2,
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[0]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
    describe('using last limit', () => {
      it('returns a dmarc summary', async () => {
        const expectedSummaries = await loadDmarcSummaryByKey({
          query,
        }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          last: 1,
          period: 'thirtyDays',
          year: '2021',
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
              node: {
                ...expectedSummaries[1],
              },
            },
          ],
          totalCount: 2,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: true,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[1]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
    describe('using the search argument', () => {
      beforeEach(async () => {
        // This is used to sync the view before running the test below
        await query`
          FOR domain IN domainSearch
            SEARCH domain.domain == "domain"
            OPTIONS { waitForSync: true }
            RETURN domain
        `
      })
      it('returns the filtered dmarc summaries', async () => {
        const summaryLoader = loadDmarcSummaryByKey({ query })
        const expectedSummaries = await summaryLoader.loadMany([
          dmarcSummary1._key,
          dmarcSummary2._key,
        ])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          first: 5,
          search: 'test1.gc.ca',
          period: 'thirtyDays',
          year: '2021',
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
              node: {
                ...expectedSummaries[0],
              },
            },
          ],
          totalCount: 1,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[0]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
    describe('using orderBy field', () => {
      describe('using after cursor', () => {
        describe('ordering on FAIL_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_DKIM_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_SPF_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on FAIL_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_DKIM_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_SPF_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on TOTAL_MESSAGES', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'total-messages',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                after: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'total-messages',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: false,
                  hasPreviousPage: true,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
      })
      describe('using before cursor', () => {
        describe('ordering on FAIL_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_DKIM_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_SPF_COUNT', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-count',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-count',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on FAIL_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'fail-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_DKIM_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-dkim-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on PASS_SPF_PERCENTAGE', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-percentage',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'pass-spf-percentage',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on TOTAL_MESSAGES', () => {
          describe('order direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'total-messages',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'total-messages',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
        describe('ordering on DOMAIN', () => {
          describe('ordering direction is ASC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'domain',
                  direction: 'ASC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[0]._key,
                    ),
                    node: {
                      ...expectedSummaries[0],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[0]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
          describe('order direction is DESC', () => {
            it('returns dmarc summaries in order', async () => {
              const expectedSummaries = await loadDmarcSummaryByKey({
                query,
              }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n: {},
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: 10,
                before: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
                period: 'thirtyDays',
                year: '2021',
                orderBy: {
                  field: 'domain',
                  direction: 'DESC',
                },
              }

              const summaries = await connectionLoader({ ...connectionArgs })

              const expectedStructure = {
                edges: [
                  {
                    cursor: toGlobalId(
                      'dmarcSummaries',
                      expectedSummaries[1]._key,
                    ),
                    node: {
                      ...expectedSummaries[1],
                    },
                  },
                ],
                totalCount: 2,
                pageInfo: {
                  hasNextPage: true,
                  hasPreviousPage: false,
                  startCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                  endCursor: toGlobalId(
                    'dmarcSummaries',
                    expectedSummaries[1]._key,
                  ),
                },
              }

              expect(summaries).toEqual(expectedStructure)
            })
          })
        })
      })
    })
    describe('isSuperAdmin is set to true', () => {
      it('returns dmarc summaries', async () => {
        const expectedSummaries = await loadDmarcSummaryByKey({
          query,
        }).loadMany([dmarcSummary1._key, dmarcSummary2._key])

        const connectionLoader = loadDmarcSummaryConnectionsByUserId({
          query,
          userKey: user._key,
          cleanseInput,
          i18n: {},
          loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
        })

        const connectionArgs = {
          first: 10,
          period: 'thirtyDays',
          year: '2021',
          isSuperAdmin: true,
        }

        const summaries = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[0]._key),
              node: {
                ...expectedSummaries[0],
              },
            },
            {
              cursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
              node: {
                ...expectedSummaries[1],
              },
            },
          ],
          totalCount: 2,
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: toGlobalId(
              'dmarcSummaries',
              expectedSummaries[0]._key,
            ),
            endCursor: toGlobalId('dmarcSummaries', expectedSummaries[1]._key),
          },
        }

        expect(summaries).toEqual(expectedStructure)
      })
    })
  })
  describe('given there are no dmarc summaries to be returned', () => {
    it('returns no dmarc summary connections', async () => {
      await truncate()

      const connectionLoader = loadDmarcSummaryConnectionsByUserId({
        query,
        userKey: user._key,
        cleanseInput,
        i18n,
        loadStartDateFromPeriod: jest.fn().mockReturnValueOnce('thirtyDays'),
      })

      const connectionArgs = {
        last: 1,
        period: 'january',
        year: '2021',
      }

      const summaries = await connectionLoader({ ...connectionArgs })

      const expectedStructure = {
        edges: [],
        totalCount: 0,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: '',
          endCursor: '',
        },
      }

      expect(summaries).toEqual(expectedStructure)
    })
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
    describe('given an unsuccessful load', () => {
      describe('first and last arguments are not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            period: 'thirtyDays',
            year: '2021',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error(
                'You must provide a `first` or `last` value to properly paginate the `dmarcSummaries` connection.',
              ),
            )
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have either \`first\` or \`last\` arguments set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('first and last arguments are set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            period: 'thirtyDays',
            year: '2021',
            first: 1,
            last: 1,
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error(
                'Passing both `first` and `last` to paginate the `dmarcSummaries` connection is not supported.',
              ),
            )
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} attempted to have \`first\` and \`last\` arguments set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('first or last argument exceeds maximum', () => {
        describe('first argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              first: 101,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Requesting `101` records on the `dmarcSummaries` connection exceeds the `first` limit of 100 records.',
                ),
              )
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set to 101 for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              last: 101,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Requesting `101` records on the `dmarcSummaries` connection exceeds the `last` limit of 100 records.',
                ),
              )
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set to 101 for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('first or last argument exceeds minimum', () => {
        describe('first argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              first: -1,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  '`first` on the `dmarcSummaries` connection cannot be less than zero.',
                ),
              )
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set below zero for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              last: -1,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  '`last` on the `dmarcSummaries` connection cannot be less than zero.',
                ),
              )
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set below zero for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('limits are not set to numbers', () => {
        describe('first limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when first set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n,
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: invalidInput,
                period: 'thirtyDays',
                year: '2021',
              }

              try {
                await connectionLoader({
                  ...connectionArgs,
                })
              } catch (err) {
                expect(err).toEqual(
                  new Error(
                    `\`first\` must be of type \`number\` not \`${typeof invalidInput}\`.`,
                  ),
                )
              }
              expect(consoleOutput).toEqual([
                `User: ${
                  user._key
                } attempted to have \`first\` set as a ${typeof invalidInput} for: loadDmarcSummaryConnectionsByUserId.`,
              ])
            })
          })
        })
        describe('last limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when last set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n,
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                last: invalidInput,
                period: 'thirtyDays',
                year: '2021',
              }

              try {
                await connectionLoader({
                  ...connectionArgs,
                })
              } catch (err) {
                expect(err).toEqual(
                  new Error(
                    `\`last\` must be of type \`number\` not \`${typeof invalidInput}\`.`,
                  ),
                )
              }
              expect(consoleOutput).toEqual([
                `User: ${
                  user._key
                } attempted to have \`last\` set as a ${typeof invalidInput} for: loadDmarcSummaryConnectionsByUserId.`,
              ])
            })
          })
        })
      })
      describe('period argument is not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            first: 1,
            year: '2021',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error(
                'You must provide a `period` value to access the `dmarcSummaries` connection.',
              ),
            )
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have \`period\` argument set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('year argument is not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            first: 1,
            period: 'january',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error(
                'You must provide a `year` value to access the `dmarcSummaries` connection.',
              ),
            )
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have \`year\` argument set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('given a database error', () => {
        describe('while querying for domain information', () => {
          it('returns an error message', async () => {
            const query = jest
              .fn()
              .mockRejectedValue(new Error('Database error occurred.'))

            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              first: 50,
              period: 'thirtyDays',
              year: '2021',
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Unable to load DMARC summary data. Please try again.',
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `Database error occurred while user: ${user._key} was trying to gather dmarc summaries in loadDmarcSummaryConnectionsByUserId, error: Error: Database error occurred.`,
            ])
          })
        })
      })
      describe('given a cursor error', () => {
        describe('while gathering domains', () => {
          it('returns an error message', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            const query = jest.fn().mockReturnValueOnce(cursor)

            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              first: 50,
              period: 'thirtyDays',
              year: '2021',
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Unable to load DMARC summary data. Please try again.',
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `Cursor error occurred while user: ${user._key} was trying to gather dmarc summaries in loadDmarcSummaryConnectionsByUserId, error: Error: Cursor error occurred.`,
            ])
          })
        })
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
    describe('given an unsuccessful load', () => {
      describe('first and last arguments are not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            period: 'thirtyDays',
            year: '2021',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have either \`first\` or \`last\` arguments set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('first and last arguments are set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            period: 'thirtyDays',
            year: '2021',
            first: 1,
            last: 1,
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} attempted to have \`first\` and \`last\` arguments set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('first or last argument exceeds maximum', () => {
        describe('first argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              first: 101,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set to 101 for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              last: 101,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set to 101 for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('first or last argument exceeds minimum', () => {
        describe('first argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              first: -1,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set below zero for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument is set', () => {
          it('returns an error message', async () => {
            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              period: 'thirtyDays',
              year: '2021',
              last: -1,
            }

            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }
            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set below zero for: loadDmarcSummaryConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('limits are not set to numbers', () => {
        describe('first limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when first set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n,
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                first: invalidInput,
                period: 'thirtyDays',
                year: '2021',
              }

              try {
                await connectionLoader({
                  ...connectionArgs,
                })
              } catch (err) {
                expect(err).toEqual(new Error(`todo`))
              }
              expect(consoleOutput).toEqual([
                `User: ${
                  user._key
                } attempted to have \`first\` set as a ${typeof invalidInput} for: loadDmarcSummaryConnectionsByUserId.`,
              ])
            })
          })
        })
        describe('last limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when last set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = loadDmarcSummaryConnectionsByUserId({
                query,
                userKey: user._key,
                cleanseInput,
                i18n,
                loadStartDateFromPeriod: jest
                  .fn()
                  .mockReturnValueOnce('thirtyDays'),
              })

              const connectionArgs = {
                last: invalidInput,
                period: 'thirtyDays',
                year: '2021',
              }

              try {
                await connectionLoader({
                  ...connectionArgs,
                })
              } catch (err) {
                expect(err).toEqual(new Error(`todo`))
              }
              expect(consoleOutput).toEqual([
                `User: ${
                  user._key
                } attempted to have \`last\` set as a ${typeof invalidInput} for: loadDmarcSummaryConnectionsByUserId.`,
              ])
            })
          })
        })
      })
      describe('period argument is not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            first: 1,
            year: '2021',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have \`period\` argument set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('year argument is not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = loadDmarcSummaryConnectionsByUserId({
            query,
            userKey: user._key,
            cleanseInput,
            i18n,
            loadStartDateFromPeriod: jest
              .fn()
              .mockReturnValueOnce('thirtyDays'),
          })

          const connectionArgs = {
            first: 1,
            period: 'january',
          }

          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }
          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have \`year\` argument set for: loadDmarcSummaryConnectionsByUserId.`,
          ])
        })
      })
      describe('given a database error', () => {
        describe('while querying for domain information', () => {
          it('returns an error message', async () => {
            const query = jest
              .fn()
              .mockRejectedValue(new Error('Database error occurred.'))

            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              first: 50,
              period: 'thirtyDays',
              year: '2021',
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Database error occurred while user: ${user._key} was trying to gather dmarc summaries in loadDmarcSummaryConnectionsByUserId, error: Error: Database error occurred.`,
            ])
          })
        })
      })
      describe('given a cursor error', () => {
        describe('while gathering domains', () => {
          it('returns an error message', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            const query = jest.fn().mockReturnValueOnce(cursor)

            const connectionLoader = loadDmarcSummaryConnectionsByUserId({
              query,
              userKey: user._key,
              cleanseInput,
              i18n,
              loadStartDateFromPeriod: jest
                .fn()
                .mockReturnValueOnce('thirtyDays'),
            })

            const connectionArgs = {
              first: 50,
              period: 'thirtyDays',
              year: '2021',
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Cursor error occurred while user: ${user._key} was trying to gather dmarc summaries in loadDmarcSummaryConnectionsByUserId, error: Error: Cursor error occurred.`,
            ])
          })
        })
      })
    })
  })
})
