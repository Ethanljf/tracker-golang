const dotenv = require('dotenv-safe')
dotenv.config()
const { DB_PASS: rootPass, DB_URL: url } = process.env

const { stringify } = require('jest-matcher-utils')
const { ArangoTools, dbNameFromFile } = require('arango-tools')
const { toGlobalId } = require('graphql-relay')
const { setupI18n } = require('@lingui/core')

const englishMessages = require('../locale/en/messages')
const frenchMessages = require('../locale/fr/messages')
const { makeMigrations } = require('../../migrations')
const { cleanseInput } = require('../validators')
const {
  domainLoaderConnectionsByUserId,
  domainLoaderByKey,
} = require('../loaders')

describe('given the load domain connections by user id function', () => {
  let query,
    drop,
    truncate,
    migrate,
    collections,
    org,
    i18n,
    user,
    domainOne,
    domainTwo

  let consoleOutput = []
  const mockedError = (output) => consoleOutput.push(output)
  const mockedWarn = (output) => consoleOutput.push(output)
  beforeAll(async () => {
    console.error = mockedError
    console.warn = mockedWarn
    ;({ migrate } = await ArangoTools({ rootPass, url }))
    ;({ query, drop, truncate, collections } = await migrate(
      makeMigrations({ databaseName: dbNameFromFile(__filename), rootPass }),
    ))
  })

  beforeEach(async () => {
    await truncate()
    await collections.users.save({
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
    const userCursor = await query`
    FOR user IN users
      FILTER user.userName == "test.account@istio.actually.exists"
      RETURN user
  `
    user = await userCursor.next()
    await collections.affiliations.save({
      _from: org._id,
      _to: user._id,
      permission: 'user',
    })
    domainOne = await collections.domains.save({
      domain: 'test1.gc.ca',
      lastRan: null,
      selectors: ['selector1._domainkey', 'selector2._domainkey'],
    })
    domainTwo = await collections.domains.save({
      domain: 'test2.gc.ca',
      lastRan: null,
      selectors: ['selector1._domainkey', 'selector2._domainkey'],
    })
    await collections.claims.save({
      _to: domainOne._id,
      _from: org._id,
    })
    await collections.claims.save({
      _to: domainTwo._id,
      _from: org._id,
    })
    consoleOutput = []
  })
  afterEach(async () => {
    await query`
      LET userEdges = (FOR v, e IN 1..1 ANY ${org._id} affiliations RETURN { edgeKey: e._key, userId: e._to })
      LET removeUserEdges = (FOR userEdge IN userEdges REMOVE userEdge.edgeKey IN affiliations)
      RETURN true
    `
    await query`
      FOR affiliation IN affiliations
        REMOVE affiliation IN affiliations
    `
    await query`
      LET domainEdges = (FOR v, e IN 1..1 ANY ${org._id} claims RETURN { edgeKey: e._key, userId: e._to })
      LET removeDomainEdges = (FOR domainEdge IN domainEdges REMOVE domainEdge.edgeKey IN claims)
      RETURN true
    `
    await query`
      FOR claim IN claims
        REMOVE claim IN claims
    `
  })
  afterAll(async () => {
    await drop()
  })

  describe('given a successful load', () => {
    describe('given there are domain connections to be returned', () => {
      describe('using no cursor', () => {
        it('returns a domain', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
          )

          const connectionArgs = {
            first: 10,
          }
          const domains = await connectionLoader({ ...connectionArgs })

          const domainLoader = domainLoaderByKey(query)
          const expectedDomains = await domainLoader.loadMany([
            domainOne._key,
            domainTwo._key,
          ])

          expectedDomains[0].id = expectedDomains[0]._key
          expectedDomains[1].id = expectedDomains[1]._key

          const expectedStructure = {
            edges: [
              {
                cursor: toGlobalId('domains', expectedDomains[0]._key),
                node: {
                  ...expectedDomains[0],
                },
              },
              {
                cursor: toGlobalId('domains', expectedDomains[1]._key),
                node: {
                  ...expectedDomains[1],
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: toGlobalId('domains', expectedDomains[0]._key),
              endCursor: toGlobalId('domains', expectedDomains[1]._key),
            },
          }

          expect(domains).toEqual(expectedStructure)
        })
      })
      describe('using after cursor', () => {
        it('returns a domain', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
          )

          const domainLoader = domainLoaderByKey(query)
          const expectedDomains = await domainLoader.loadMany([
            domainOne._key,
            domainTwo._key,
          ])

          expectedDomains[0].id = expectedDomains[0]._key
          expectedDomains[1].id = expectedDomains[1]._key

          const connectionArgs = {
            first: 10,
            after: toGlobalId('domains', expectedDomains[0].id),
          }
          const domains = await connectionLoader({ ...connectionArgs })

          const expectedStructure = {
            edges: [
              {
                cursor: toGlobalId('domains', expectedDomains[1]._key),
                node: {
                  ...expectedDomains[1],
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: true,
              startCursor: toGlobalId('domains', expectedDomains[1]._key),
              endCursor: toGlobalId('domains', expectedDomains[1]._key),
            },
          }

          expect(domains).toEqual(expectedStructure)
        })
      })
      describe('using before cursor', () => {
        it('returns a domain', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
          )

          const domainLoader = domainLoaderByKey(query)
          const expectedDomains = await domainLoader.loadMany([
            domainOne._key,
            domainTwo._key,
          ])

          expectedDomains[0].id = expectedDomains[0]._key
          expectedDomains[1].id = expectedDomains[1]._key

          const connectionArgs = {
            first: 10,
            before: toGlobalId('domains', expectedDomains[1].id),
          }
          const domains = await connectionLoader({ ...connectionArgs })

          const expectedStructure = {
            edges: [
              {
                cursor: toGlobalId('domains', expectedDomains[0]._key),
                node: {
                  ...expectedDomains[0],
                },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: toGlobalId('domains', expectedDomains[0]._key),
              endCursor: toGlobalId('domains', expectedDomains[0]._key),
            },
          }

          expect(domains).toEqual(expectedStructure)
        })
      })
      describe('using first limit', () => {
        it('returns a domain', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
          )

          const domainLoader = domainLoaderByKey(query)
          const expectedDomains = await domainLoader.loadMany([
            domainOne._key,
            domainTwo._key,
          ])

          expectedDomains[0].id = expectedDomains[0]._key
          expectedDomains[1].id = expectedDomains[1]._key

          const connectionArgs = {
            first: 1,
          }
          const domains = await connectionLoader({ ...connectionArgs })

          const expectedStructure = {
            edges: [
              {
                cursor: toGlobalId('domains', expectedDomains[0]._key),
                node: {
                  ...expectedDomains[0],
                },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: toGlobalId('domains', expectedDomains[0]._key),
              endCursor: toGlobalId('domains', expectedDomains[0]._key),
            },
          }

          expect(domains).toEqual(expectedStructure)
        })
      })
      describe('using last limit', () => {
        it('returns a domain', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
          )

          const domainLoader = domainLoaderByKey(query)
          const expectedDomains = await domainLoader.loadMany([
            domainOne._key,
            domainTwo._key,
          ])

          expectedDomains[0].id = expectedDomains[0]._key
          expectedDomains[1].id = expectedDomains[1]._key

          const connectionArgs = {
            last: 1,
          }
          const domains = await connectionLoader({ ...connectionArgs })

          const expectedStructure = {
            edges: [
              {
                cursor: toGlobalId('domains', expectedDomains[1]._key),
                node: {
                  ...expectedDomains[1],
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: true,
              startCursor: toGlobalId('domains', expectedDomains[1]._key),
              endCursor: toGlobalId('domains', expectedDomains[1]._key),
            },
          }

          expect(domains).toEqual(expectedStructure)
        })
      })
    })
    describe('given there are no domain connections to be returned', () => {
      it('returns no domain connections', async () => {
        await truncate()

        const connectionLoader = domainLoaderConnectionsByUserId(
          query,
          user._key,
          cleanseInput,
        )

        const connectionArgs = {
          first: 10,
        }
        const domains = await connectionLoader({ ...connectionArgs })

        const expectedStructure = {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: '',
            endCursor: '',
          },
        }

        expect(domains).toEqual(expectedStructure)
      })
    })
  })
  describe('users language is set to english', () => {
    beforeAll(() => {
      i18n = setupI18n({
        language: 'en',
        locales: ['en', 'fr'],
        missing: 'Traduction manquante',
        catalogs: {
          en: englishMessages,
          fr: frenchMessages,
        },
      })
    })
    describe('given an unsuccessful load', () => {
      describe('first and last arguments are not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {}
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error(
                `You must provide a \`first\` or \`last\` value to properly paginate the \`domain\` connection.`,
              ),
            )
          }

          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have either \`first\` or \`last\` arguments set for: domainLoaderConnectionsByUserId.`,
          ])
        })
      })
      describe('first and last arguments are set', () => {
        it('returns an error message', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
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
                `Passing both \`first\` and \`last\` to paginate the \`domain\` connection is not supported.`,
              ),
            )
          }

          expect(consoleOutput).toEqual([
            `User: ${user._key} attempted to have \`first\` and \`last\` arguments set for: domainLoaderConnectionsByUserId.`,
          ])
        })
      })
      describe('first or last argument exceeds maximum', () => {
        describe('first argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              first: 1000,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Requesting `1000` records on the `domain` connection exceeds the `first` limit of 100 records.',
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set to 1000 for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              last: 1000,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  'Requesting `1000` records on the `domain` connection exceeds the `last` limit of 100 records.',
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set to 1000 for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('first or last argument exceeds minimum', () => {
        describe('first argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              first: -1,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  `\`first\` on the \`domain\` connection cannot be less than zero.`,
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set below zero for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              last: -1,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(
                new Error(
                  `\`last\` on the \`domain\` connection cannot be less than zero.`,
                ),
              )
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set below zero for: domainLoaderConnectionsByUserId.`,
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
              const connectionLoader = domainLoaderConnectionsByUserId(
                query,
                user._key,
                cleanseInput,
                i18n,
              )

              const connectionArgs = {
                first: invalidInput,
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
                } attempted to have \`first\` set as a ${typeof invalidInput} for: domainLoaderConnectionsByUserId.`,
              ])
            })
          })
        })
        describe('last limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when last set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = domainLoaderConnectionsByUserId(
                query,
                user._key,
                cleanseInput,
                i18n,
              )

              const connectionArgs = {
                last: invalidInput,
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
                } attempted to have \`last\` set as a ${typeof invalidInput} for: domainLoaderConnectionsByUserId.`,
              ])
            })
          })
        })
      })
    })
    describe('given a database error', () => {
      describe('while querying for domain information', () => {
        it('returns an error message', async () => {
          const query = jest
            .fn()
            .mockRejectedValue(
              new Error('Unable to query domains. Please try again.'),
            )

          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
            first: 50,
          }
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error('Unable to query domains. Please try again.'),
            )
          }

          expect(consoleOutput).toEqual([
            `Database error occurred while user: ${user._key} was trying to query domains in loadDomainsByUser.`,
          ])
        })
      })
    })
    describe('given a cursor error', () => {
      describe('while gathering domains', () => {
        it('returns an error message', async () => {
          const cursor = {
            next() {
              throw new Error('Unable to load domains. Please try again.')
            },
          }
          const query = jest
            .fn()
            .mockReturnValueOnce([domainOne._id, domainTwo._id])
            .mockReturnValueOnce(cursor)

          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
            first: 50,
          }
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(
              new Error('Unable to load domains. Please try again.'),
            )
          }

          expect(consoleOutput).toEqual([
            `Cursor error occurred while user: ${user._key} was trying to gather domains in loadDomainsByUser.`,
          ])
        })
      })
    })
  })
  describe('users language is set to french', () => {
    beforeAll(() => {
      i18n = setupI18n({
        language: 'fr',
        locales: ['en', 'fr'],
        missing: 'Traduction manquante',
        catalogs: {
          en: englishMessages,
          fr: frenchMessages,
        },
      })
    })
    describe('given an unsuccessful load', () => {
      describe('first and last arguments are not set', () => {
        it('returns an error message', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {}
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error(`todo`))
          }

          expect(consoleOutput).toEqual([
            `User: ${user._key} did not have either \`first\` or \`last\` arguments set for: domainLoaderConnectionsByUserId.`,
          ])
        })
      })
      describe('first and last arguments are set', () => {
        it('returns an error message', async () => {
          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
            first: 1,
            last: 1,
          }
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error(`todo`))
          }

          expect(consoleOutput).toEqual([
            `User: ${user._key} attempted to have \`first\` and \`last\` arguments set for: domainLoaderConnectionsByUserId.`,
          ])
        })
      })
      describe('first or last argument exceeds maximum', () => {
        describe('first argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              first: 1000,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error(`todo`))
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set to 1000 for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              last: 1000,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error(`todo`))
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set to 1000 for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
      })
      describe('first or last argument exceeds minimum', () => {
        describe('first argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              first: -1,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error(`todo`))
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`first\` set below zero for: domainLoaderConnectionsByUserId.`,
            ])
          })
        })
        describe('last argument set', () => {
          it('returns an error message', async () => {
            const connectionLoader = domainLoaderConnectionsByUserId(
              query,
              user._key,
              cleanseInput,
              i18n,
            )

            const connectionArgs = {
              last: -1,
            }
            try {
              await connectionLoader({
                ...connectionArgs,
              })
            } catch (err) {
              expect(err).toEqual(new Error(`todo`))
            }

            expect(consoleOutput).toEqual([
              `User: ${user._key} attempted to have \`last\` set below zero for: domainLoaderConnectionsByUserId.`,
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
              const connectionLoader = domainLoaderConnectionsByUserId(
                query,
                user._key,
                cleanseInput,
                i18n,
              )

              const connectionArgs = {
                first: invalidInput,
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
                } attempted to have \`first\` set as a ${typeof invalidInput} for: domainLoaderConnectionsByUserId.`,
              ])
            })
          })
        })
        describe('last limit is set', () => {
          ;['123', {}, [], null, true].forEach((invalidInput) => {
            it(`returns an error when last set to ${stringify(
              invalidInput,
            )}`, async () => {
              const connectionLoader = domainLoaderConnectionsByUserId(
                query,
                user._key,
                cleanseInput,
                i18n,
              )

              const connectionArgs = {
                last: invalidInput,
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
                } attempted to have \`last\` set as a ${typeof invalidInput} for: domainLoaderConnectionsByUserId.`,
              ])
            })
          })
        })
      })
    })
    describe('given a database error', () => {
      describe('while querying domains', () => {
        it('returns an error message', async () => {
          const query = jest
            .fn()
            .mockRejectedValue(
              new Error('Unable to query domains. Please try again.'),
            )

          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
            first: 50,
          }
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }

          expect(consoleOutput).toEqual([
            `Database error occurred while user: ${user._key} was trying to query domains in loadDomainsByUser.`,
          ])
        })
      })
    })
    describe('given a cursor error', () => {
      describe('while gathering domains', () => {
        it('returns an error message', async () => {
          const cursor = {
            next() {
              throw new Error('Unable to load domains. Please try again.')
            },
          }
          const query = jest
            .fn()
            .mockReturnValueOnce([domainOne._id, domainTwo._id])
            .mockReturnValueOnce(cursor)

          const connectionLoader = domainLoaderConnectionsByUserId(
            query,
            user._key,
            cleanseInput,
            i18n,
          )

          const connectionArgs = {
            first: 50,
          }
          try {
            await connectionLoader({
              ...connectionArgs,
            })
          } catch (err) {
            expect(err).toEqual(new Error('todo'))
          }

          expect(consoleOutput).toEqual([
            `Cursor error occurred while user: ${user._key} was trying to gather domains in loadDomainsByUser.`,
          ])
        })
      })
    })
  })
})