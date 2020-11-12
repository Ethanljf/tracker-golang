const { DB_PASS: rootPass, DB_URL: url } = process.env

const { ArangoTools, dbNameFromFile } = require('arango-tools')
const { setupI18n } = require('@lingui/core')

const { makeMigrations } = require('../../../migrations')
const { checkPermission } = require('..')
const englishMessages = require('../../locale/en/messages')
const frenchMessages = require('../../locale/fr/messages')

describe('given the check permission function', () => {
  let query, drop, truncate, migrate, collections, i18n

  let consoleOutput = []
  const mockedError = (output) => consoleOutput.push(output)
  beforeAll(async () => {
    console.error = mockedError
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
    await collections.organizations.save({
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
    consoleOutput = []
  })

  afterAll(async () => {
    await drop()
  })

  describe('given a successful permission check', () => {
    describe('if the user is a super admin for a given organization', () => {
      let user, org
      beforeEach(async () => {
        const userCursor = await query`
          FOR user IN users
            FILTER user.userName == "test.account@istio.actually.exists"
            RETURN user
        `
        const orgCursor = await query`
          FOR org IN organizations
            FILTER (LOWER("treasury-board-secretariat") == LOWER(TRANSLATE("en", org.orgDetails).slug))
            RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev }, TRANSLATE("en", org.orgDetails))
        `
        user = await userCursor.next()
        org = await orgCursor.next()

        await query`
          INSERT {
            _from: ${org._id},
            _to: ${user._id},
            permission: "super_admin"
          } INTO affiliations
        `
      })
      it('will return the users permission level', async () => {
        const testCheckPermission = checkPermission({
          userId: user._key,
          query,
        })
        const permission = await testCheckPermission({ orgId: org._id })
        expect(permission).toEqual('super_admin')
      })
    })
    describe('if the user is an admin for a given organization', () => {
      let user, org
      beforeEach(async () => {
        const userCursor = await query`
          FOR user IN users
            FILTER user.userName == "test.account@istio.actually.exists"
            RETURN user
        `
        const orgCursor = await query`
          FOR org IN organizations
            FILTER (LOWER("treasury-board-secretariat") == LOWER(TRANSLATE("en", org.orgDetails).slug))
            RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev }, TRANSLATE("en", org.orgDetails))
        `
        user = await userCursor.next()
        org = await orgCursor.next()

        await query`
          INSERT {
            _from: ${org._id},
            _to: ${user._id},
            permission: "admin"
          } INTO affiliations
        `
      })
      it('will return the users permission level', async () => {
        const testCheckPermission = checkPermission({
          userId: user._key,
          query,
        })
        const permission = await testCheckPermission({ orgId: org._id })
        expect(permission).toEqual('admin')
      })
    })
    describe('if the user is a user for a given organization', () => {
      let user, org
      beforeEach(async () => {
        const userCursor = await query`
          FOR user IN users
            FILTER user.userName == "test.account@istio.actually.exists"
            RETURN user
        `
        const orgCursor = await query`
          FOR org IN organizations
            FILTER (LOWER("treasury-board-secretariat") == LOWER(TRANSLATE("en", org.orgDetails).slug))
            RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev }, TRANSLATE("en", org.orgDetails))
        `
        user = await userCursor.next()
        org = await orgCursor.next()

        await query`
          INSERT {
            _from: ${org._id},
            _to: ${user._id},
            permission: "user"
          } INTO affiliations
        `
      })
      it('will return the users permission level', async () => {
        const testCheckPermission = checkPermission({
          userId: user._key,
          query,
        })
        const permission = await testCheckPermission({ orgId: org._id })
        expect(permission).toEqual('user')
      })
    })
  })
  describe('given an unsuccessful permission check', () => {
    describe('user does not belong to that organization', () => {
      let user, org
      beforeEach(async () => {
        const userCursor = await query`
          FOR user IN users
            FILTER user.userName == "test.account@istio.actually.exists"
            RETURN user
        `
        const orgCursor = await query`
          FOR org IN organizations
            FILTER (LOWER("treasury-board-secretariat") == LOWER(TRANSLATE("en", org.orgDetails).slug))
            RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev }, TRANSLATE("en", org.orgDetails))
        `
        user = await userCursor.next()
        org = await orgCursor.next()
      })
      it('will return the users permission level', async () => {
        const testCheckPermission = checkPermission({
          userId: user._key,
          query,
        })
        const permission = await testCheckPermission({ orgId: org._id })
        expect(permission).toEqual(undefined)
      })
    })
    describe('language is set to english', () => {
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
      describe('database error occurs', () => {
        describe('when checking if super admin', () => {
          it('throws an error', async () => {
            query = jest
              .fn()
              .mockRejectedValue(new Error('Database error occurred.'))

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(
                new Error('Authentication error. Please sign in again.'),
              )
            }

            expect(consoleOutput).toEqual([
              `Database error when checking to see if user: users/1 has super admin permission: Error: Database error occurred.`,
            ])
          })
        })
        describe('when checking for other roles', () => {
          it('throws an error', async () => {
            query = jest
              .fn()
              .mockReturnValueOnce({
                next() {
                  return 'test'
                },
              })
              .mockRejectedValue(new Error('Database error occurred.'))

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(
                new Error('Authentication error. Please sign in again.'),
              )
            }

            expect(consoleOutput).toEqual([
              `Database error occurred when checking users/1's permission: Error: Database error occurred.`,
            ])
          })
        })
      })
      describe('cursor error occurs', () => {
        describe('when checking if super admin', () => {
          it('throws an error', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            query = jest.fn().mockReturnValue(cursor)

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(
                new Error('Unable to check permission. Please try again.'),
              )
            }

            expect(consoleOutput).toEqual([
              `Cursor error when checking to see if user users/1 has super admin permission: Error: Cursor error occurred.`,
            ])
          })
        })
        describe('when checking for other roles', () => {
          it('throws an error', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            query = jest
              .fn()
              .mockReturnValueOnce({
                next() {
                  return 'user'
                },
              })
              .mockReturnValue(cursor)

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(
                new Error('Unable to check permission. Please try again.'),
              )
            }

            expect(consoleOutput).toEqual([
              `Cursor error when checking users/1's permission: Error: Cursor error occurred.`,
            ])
          })
        })
      })
    })
    describe('language is set to french', () => {
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
      describe('database error occurs', () => {
        describe('when checking if super admin', () => {
          it('throws an error', async () => {
            query = jest
              .fn()
              .mockRejectedValue(new Error('Database error occurred.'))

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Database error when checking to see if user: users/1 has super admin permission: Error: Database error occurred.`,
            ])
          })
        })
        describe('when checking for other roles', () => {
          it('throws an error', async () => {
            query = jest
              .fn()
              .mockReturnValueOnce({
                next() {
                  return 'test'
                },
              })
              .mockRejectedValue(new Error('Database error occurred.'))

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Database error occurred when checking users/1's permission: Error: Database error occurred.`,
            ])
          })
        })
      })
      describe('cursor error occurs', () => {
        describe('when checking if super admin', () => {
          it('throws an error', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            query = jest.fn().mockReturnValue(cursor)

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Cursor error when checking to see if user users/1 has super admin permission: Error: Cursor error occurred.`,
            ])
          })
        })
        describe('when checking for other roles', () => {
          it('throws an error', async () => {
            const cursor = {
              next() {
                throw new Error('Cursor error occurred.')
              },
            }
            query = jest
              .fn()
              .mockReturnValueOnce({
                next() {
                  return 'user'
                },
              })
              .mockReturnValue(cursor)

            try {
              const testCheckPermission = checkPermission({
                i18n,
                userId: '1',
                query,
              })
              await testCheckPermission({ orgId: 'organizations/1' })
            } catch (err) {
              expect(err).toEqual(new Error('todo'))
            }

            expect(consoleOutput).toEqual([
              `Cursor error when checking users/1's permission: Error: Cursor error occurred.`,
            ])
          })
        })
      })
    })
  })
})