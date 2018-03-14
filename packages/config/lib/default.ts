import { Strategy } from 'passport-facebook';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export = {
  core: {
    namespace: 'one'
  },
  eventEmitter: {},
  graphql: {
    endpoint:           '/graphql',
    graphiQlEndpoint:   '/graphiql',
    schemaPattern:      '/schema/*.gql',
    viewsPattern: '/views/*.ts',
    expressionsPattern: '/expressions/*.ts',
    resolversPattern: '/resolvers/*.ts'
  },
  db: {
    viewSchemaName: 'graphql',
    updateClientListInterval: 10000
  },
  auth: {
    sodium: {},
    oAuth: {
      cookie: {
        maxAge: 86400000,
        overwrite: true,
        httpOnly: true,
        signed: true
      },
      providers: {
        facebook: {
          name: 'facebook',
          tenant: 'default',
          strategy: Strategy,
          config: {
            clientID: 2045088022395430,
            clientSecret: 'ad5b17b47d056393b687c20b64fea2b5',
            profileFields: ['id', 'email']
          }
        },
        google: {
          name: 'google',
          tenant: 'default',
          strategy: GoogleStrategy,
          config: {
            clientID: '24830444193-hoqu3rnqie6078upl25dp6dircdq4c8c.apps.googleusercontent.com',
            clientSecret: '1tf3kDvh2UkNdaF68HA3lS_F',
            profileFields: ['id', 'email']
          }
        }
      },
      frontendOrigins: [
        'http://localhost:3000'
      ],
      serverApiAddress: 'http://localhost:3000'
    },
    cookie: {
      name: 'access_token',
      maxAge: 86400000,
      overwrite: true,
      httpOnly: true,
      signed: true
    },
    tokenQueryParameter: 'access_token',
    enableDefaultLocalStrategie: true
  }
};
