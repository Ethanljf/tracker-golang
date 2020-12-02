const { DB_PASS: rootPass, DB_URL: url, CIPHER_KEY } = process.env

const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { ArangoTools, dbNameFromFile } = require('arango-tools')
const { graphql, GraphQLSchema, GraphQLError } = require('graphql')
const { setupI18n } = require('@lingui/core')

const englishMessages = require('../../../locale/en/messages')
const frenchMessages = require('../../../locale/fr/messages')
const { makeMigrations } = require('../../../../migrations')
const { createQuerySchema } = require('../../../queries')
const { createMutationSchema } = require('../..')
const { cleanseInput } = require('../../../validators')
const { tokenize } = require('../../../auth')
const { userLoaderByUserName, userLoaderByKey } = require('../../../loaders')

describe('authenticate user account', () => {
  let query, drop, truncate, migrate, collections, schema, i18n

  let consoleOutput = []
  const mockedInfo = (output) => consoleOutput.push(output)
  const mockedWarn = (output) => consoleOutput.push(output)
  const mockedError = (output) => consoleOutput.push(output)

  beforeAll(async () => {
    // Create GQL Schema
    schema = new GraphQLSchema({
      query: createQuerySchema(),
      mutation: createMutationSchema(),
    })
    // Generate DB Items
    ;({ migrate } = await ArangoTools({ rootPass, url }))
    ;({ query, drop, truncate, collections } = await migrate(
      makeMigrations({ databaseName: dbNameFromFile(__filename), rootPass }),
    ))
  })

  beforeEach(async () => {
    console.info = mockedInfo
    console.warn = mockedWarn
    console.error = mockedError

    await collections.users.save({
      displayName: 'Test Account',
      userName: 'test.account@istio.actually.exists',
      preferredLang: 'french',
    })
    consoleOutput = []
  })

  afterEach(async () => {
    await truncate()
  })

  afterAll(async () => {
    await drop()
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
    describe('given successful update of users profile', () => {
      describe('user updates their display name', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(input: { displayName: "John Doe" }) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'Profile successfully updated.',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          user = await cursor.next()
          expect(user.displayName).toEqual('John Doe')
        })
      })
      describe('user updates their user name', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: { userName: "john.doe@istio.actually.works" }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'Profile successfully updated.',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "john.doe@istio.actually.works"
              RETURN user
          `
          user = await cursor.next()
          expect(user.userName).toEqual('john.doe@istio.actually.works')
        })
      })
      describe('user updates their preferred language', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(input: { preferredLang: ENGLISH }) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'Profile successfully updated.',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          user = await cursor.next()
          expect(user.preferredLang).toEqual('english')
        })
      })
      describe('user attempts to update their phone number', () => {
        describe('user is phone validated', () => {
          describe('user updates their phone number', () => {
            beforeEach(async () => {
              await truncate()
              const updatedPhoneDetails = {
                iv: crypto.randomBytes(12).toString('hex'),
              }
              const cipher = crypto.createCipheriv(
                'aes-256-ccm',
                String(CIPHER_KEY),
                Buffer.from(updatedPhoneDetails.iv, 'hex'),
                { authTagLength: 16 },
              )
              let encrypted = cipher.update('+12345678998', 'utf8', 'hex')
              encrypted += cipher.final('hex')

              updatedPhoneDetails.phoneNumber = encrypted
              updatedPhoneDetails.tag = cipher.getAuthTag().toString('hex')

              await collections.users.save({
                displayName: 'Test Account',
                userName: 'test.account@istio.actually.exists',
                preferredLang: 'french',
                phoneValidated: true,
                phoneDetails: updatedPhoneDetails,
              })
            })
            it('returns a successful status message', async () => {
              let cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
              let user = await cursor.next()

              const response = await graphql(
                schema,
                `
                  mutation {
                    updateUserProfile(input: { phoneNumber: "+98765432112" }) {
                      status
                    }
                  }
                `,
                null,
                {
                  i18n,
                  query,
                  userKey: user._key,
                  auth: {
                    bcrypt,
                    tokenize,
                  },
                  validators: {
                    cleanseInput,
                  },
                  loaders: {
                    userLoaderByUserName: userLoaderByUserName(query),
                    userLoaderByKey: userLoaderByKey(query),
                  },
                },
              )

              const expectedResponse = {
                data: {
                  updateUserProfile: {
                    status: 'Profile successfully updated.',
                  },
                },
              }

              expect(response).toEqual(expectedResponse)
              expect(consoleOutput).toEqual([
                `User: ${user._key} successfully updated their profile.`,
              ])

              cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
              user = await cursor.next()

              const { iv, tag, phoneNumber: encrypted } = user.phoneDetails
              const decipher = crypto.createDecipheriv(
                'aes-256-ccm',
                String(CIPHER_KEY),
                Buffer.from(iv, 'hex'),
                { authTagLength: 16 },
              )
              decipher.setAuthTag(Buffer.from(tag, 'hex'))
              let decrypted = decipher.update(encrypted, 'hex', 'utf8')
              decrypted += decipher.final('utf8')

              expect(decrypted).toEqual('+98765432112')
            })
          })
          describe('phone number is the same', () => {
            beforeEach(async () => {
              await truncate()
              const updatedPhoneDetails = {
                iv: crypto.randomBytes(12).toString('hex'),
              }
              const cipher = crypto.createCipheriv(
                'aes-256-ccm',
                String(CIPHER_KEY),
                Buffer.from(updatedPhoneDetails.iv, 'hex'),
                { authTagLength: 16 },
              )
              let encrypted = cipher.update('+12345678998', 'utf8', 'hex')
              encrypted += cipher.final('hex')

              updatedPhoneDetails.phoneNumber = encrypted
              updatedPhoneDetails.tag = cipher.getAuthTag().toString('hex')

              await collections.users.save({
                displayName: 'Test Account',
                userName: 'test.account@istio.actually.exists',
                preferredLang: 'french',
                phoneValidated: true,
                phoneDetails: updatedPhoneDetails,
              })
            })
            it('returns a successful status message', async () => {
              let cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
              let user = await cursor.next()

              const response = await graphql(
                schema,
                `
                  mutation {
                    updateUserProfile(input: { phoneNumber: "+12345678998" }) {
                      status
                    }
                  }
                `,
                null,
                {
                  i18n,
                  query,
                  userKey: user._key,
                  auth: {
                    bcrypt,
                    tokenize,
                  },
                  validators: {
                    cleanseInput,
                  },
                  loaders: {
                    userLoaderByUserName: userLoaderByUserName(query),
                    userLoaderByKey: userLoaderByKey(query),
                  },
                },
              )

              const expectedResponse = {
                data: {
                  updateUserProfile: {
                    status: 'Profile successfully updated.',
                  },
                },
              }

              expect(response).toEqual(expectedResponse)
              expect(consoleOutput).toEqual([
                `User: ${user._key} successfully updated their profile.`,
              ])

              cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
              user = await cursor.next()

              const { iv, tag, phoneNumber: encrypted } = user.phoneDetails
              const decipher = crypto.createDecipheriv(
                'aes-256-ccm',
                String(CIPHER_KEY),
                Buffer.from(iv, 'hex'),
                { authTagLength: 16 },
              )
              decipher.setAuthTag(Buffer.from(tag, 'hex'))
              let decrypted = decipher.update(encrypted, 'hex', 'utf8')
              decrypted += decipher.final('utf8')

              expect(decrypted).toEqual('+12345678998')
            })
          })
        })
        describe('user is not phone validated', () => {
          beforeEach(async () => {
            await truncate()

            await collections.users.save({
              displayName: 'Test Account',
              userName: 'test.account@istio.actually.exists',
              preferredLang: 'french',
              phoneValidated: false,
            })
          })
          it('does not update their phone number', async () => {
            let cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
            let user = await cursor.next()

            const response = await graphql(
              schema,
              `
                mutation {
                  updateUserProfile(input: { phoneNumber: "+12345678998" }) {
                    status
                  }
                }
              `,
              null,
              {
                i18n,
                query,
                userKey: user._key,
                auth: {
                  bcrypt,
                  tokenize,
                },
                validators: {
                  cleanseInput,
                },
                loaders: {
                  userLoaderByUserName: userLoaderByUserName(query),
                  userLoaderByKey: userLoaderByKey(query),
                },
              },
            )

            const expectedResponse = {
              data: {
                updateUserProfile: {
                  status: 'Profile successfully updated.',
                },
              },
            }

            expect(response).toEqual(expectedResponse)
            expect(consoleOutput).toEqual([
              `User: ${user._key} successfully updated their profile.`,
            ])

            cursor = await query`
                FOR user IN users
                  FILTER user.userName == "test.account@istio.actually.exists"
                  RETURN user
              `
            user = await cursor.next()

            expect(typeof user.phoneDetails).toEqual('undefined')
          })
        })
      })
      describe('user updates display name, user name, preferred language, and phone number', () => {
        let updatedPhoneDetails
        beforeEach(async () => {
          await truncate()
          updatedPhoneDetails = {
            iv: crypto.randomBytes(12).toString('hex'),
          }
          const cipher = crypto.createCipheriv(
            'aes-256-ccm',
            String(CIPHER_KEY),
            Buffer.from(updatedPhoneDetails.iv, 'hex'),
            { authTagLength: 16 },
          )
          let encrypted = cipher.update('+12345678998', 'utf8', 'hex')
          encrypted += cipher.final('hex')

          updatedPhoneDetails.phoneNumber = encrypted
          updatedPhoneDetails.tag = cipher.getAuthTag().toString('hex')

          await collections.users.save({
            displayName: 'Test Account',
            userName: 'test.account@istio.actually.exists',
            preferredLang: 'french',
            phoneValidated: true,
            phoneDetails: updatedPhoneDetails,
          })
        })
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                    phoneNumber: "+12345678998"
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'Profile successfully updated.',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "john.smith@istio.actually.works"
              RETURN user
          `
          user = await cursor.next()
          expect(user.displayName).toEqual('John Smith')
          expect(user.userName).toEqual('john.smith@istio.actually.works')
          expect(user.preferredLang).toEqual('english')
          const { iv, tag, phoneNumber: encrypted } = user.phoneDetails
          const decipher = crypto.createDecipheriv(
            'aes-256-ccm',
            String(CIPHER_KEY),
            Buffer.from(iv, 'hex'),
            { authTagLength: 16 },
          )
          decipher.setAuthTag(Buffer.from(tag, 'hex'))
          let decrypted = decipher.update(encrypted, 'hex', 'utf8')
          decrypted += decipher.final('utf8')

          expect(decrypted).toEqual('+12345678998')
        })
      })
    })
    describe('given unsuccessful update of users profile', () => {
      describe('user id is undefined', () => {
        it('returns an error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: undefined,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const error = [
            new GraphQLError('Authentication error, please sign in again.'),
          ]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            'User attempted to update their profile, but the user id is undefined.',
          ])
        })
      })
      describe('user cannot be found in the database', () => {
        it('returns an error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: 1,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const error = [
            new GraphQLError('Unable to update profile. Please try again.'),
          ]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `User: 1 attempted to update their profile, but no account is associated with that id.`,
          ])
        })
      })
      describe('database error occurs when updating profile', () => {
        it('returns an error message', async () => {
          const cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          const user = await cursor.next()

          const userNameLoader = userLoaderByUserName(query)
          const idLoader = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query: mockedQuery,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userNameLoader,
                userLoaderByKey: idLoader,
              },
            },
          )

          const error = [
            new GraphQLError('Unable to update profile. Please try again.'),
          ]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error ocurred when user: ${user._key} attempted to update their profile: Error: Database error occurred.`,
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
    describe('given successful update of users profile', () => {
      describe('user updates their display name', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(input: { displayName: "John Doe" }) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'todo',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          user = await cursor.next()
          expect(user.displayName).toEqual('John Doe')
        })
      })
      describe('user updates their user name', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: { userName: "john.doe@istio.actually.works" }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'todo',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "john.doe@istio.actually.works"
              RETURN user
          `
          user = await cursor.next()
          expect(user.userName).toEqual('john.doe@istio.actually.works')
        })
      })
      describe('user updates their preferred language', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(input: { preferredLang: ENGLISH }) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'todo',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          user = await cursor.next()
          expect(user.preferredLang).toEqual('english')
        })
      })
      describe('user updates display name, user name, and preferred language', () => {
        it('returns a successful status message', async () => {
          let cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          let user = await cursor.next()

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const expectedResponse = {
            data: {
              updateUserProfile: {
                status: 'todo',
              },
            },
          }

          expect(response).toEqual(expectedResponse)
          expect(consoleOutput).toEqual([
            `User: ${user._key} successfully updated their profile.`,
          ])

          cursor = await query`
            FOR user IN users
              FILTER user.userName == "john.smith@istio.actually.works"
              RETURN user
          `
          user = await cursor.next()
          expect(user.displayName).toEqual('John Smith')
          expect(user.userName).toEqual('john.smith@istio.actually.works')
          expect(user.preferredLang).toEqual('english')
        })
      })
    })
    describe('given unsuccessful update of users profile', () => {
      describe('user id is undefined', () => {
        it('returns an error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: undefined,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const error = [new GraphQLError('todo')]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            'User attempted to update their profile, but the user id is undefined.',
          ])
        })
      })
      describe('user cannot be found in the database', () => {
        it('returns an error message', async () => {
          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query,
              userKey: 1,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userLoaderByUserName(query),
                userLoaderByKey: userLoaderByKey(query),
              },
            },
          )

          const error = [new GraphQLError('todo')]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `User: 1 attempted to update their profile, but no account is associated with that id.`,
          ])
        })
      })
      describe('database error occurs when updating profile', () => {
        it('returns an error message', async () => {
          const cursor = await query`
            FOR user IN users
              FILTER user.userName == "test.account@istio.actually.exists"
              RETURN user
          `
          const user = await cursor.next()

          const userNameLoader = userLoaderByUserName(query)
          const idLoader = userLoaderByKey(query)

          const mockedQuery = jest
            .fn()
            .mockRejectedValue(new Error('Database error occurred.'))

          const response = await graphql(
            schema,
            `
              mutation {
                updateUserProfile(
                  input: {
                    displayName: "John Smith"
                    userName: "john.smith@istio.actually.works"
                    preferredLang: ENGLISH
                  }
                ) {
                  status
                }
              }
            `,
            null,
            {
              i18n,
              query: mockedQuery,
              userKey: user._key,
              auth: {
                bcrypt,
                tokenize,
              },
              validators: {
                cleanseInput,
              },
              loaders: {
                userLoaderByUserName: userNameLoader,
                userLoaderByKey: idLoader,
              },
            },
          )

          const error = [new GraphQLError('todo')]

          expect(response.errors).toEqual(error)
          expect(consoleOutput).toEqual([
            `Database error ocurred when user: ${user._key} attempted to update their profile: Error: Database error occurred.`,
          ])
        })
      })
    })
  })
})
