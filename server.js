const express = require('express');
const graphql = require('express-graphql');
const tools = require('graphql-tools');
const crypto = require('crypto');

// GraphQL schema
const typeDefs = `
  type Query {
    group(name: String!): Group
    secret(name: String!): Secret
    client(name: String!): Client
  }
  type Group {
    name: String!
    clients: [Client!]!
    secrets: [Secret!]!
  }
  type Secret {
    name: String!
    content: String!
  }
  type Client {
    name: String!
  }
`;

// Crypto
const key = crypto.randomBytes(16);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);

  let ciphertext = cipher.update(text);
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  return {
    iv,
    ciphertext,
    authtag: cipher.getAuthTag(),
  };
}

function decrypt(parts) {
  const cipher = crypto.createDecipheriv('aes-128-gcm', key, parts.iv);
  cipher.setAuthTag(parts.authtag);

  let plaintext = cipher.update(parts.ciphertext);
  plaintext = Buffer.concat([plaintext, cipher.final()]);

  return plaintext.toString();
}

// Data
const allSecrets = [
  {
    name: 'secret1',
    content: encrypt('secret1'),
  },
  {
    name: 'secret2',
    content: encrypt('secret2'),
  },
];

const allClients = [
  {
    name: 'client1',
  },
  {
    name: 'client2',
  },
];

const allGroups = [
  {
    name: 'group1',
    secrets: ['secret1', 'secret2'],
    clients: ['client1', 'client2'],
  },
];

function find(haystack, needle) {
  return haystack.find(e => e.name === needle);
}

function select(haystack, needles) {
  return haystack.filter(e => needles.includes(e.name));
}

// Resolvers
const resolvers = {
  Query: {
    secret: (_, { name }) => find(allSecrets, name),
    client: (_, { name }) => find(allClients, name),
    group: (_, { name }) => find(allGroups, name),
  },
  Group: {
    clients: obj => select(allClients, obj.clients),
    secrets: obj => select(allSecrets, obj.secrets),
  },
  Secret: {
    content: obj => decrypt(obj.content),
  },
};

const schema = tools.makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Create an server
const app = express();
app.get('/query', graphql({
  schema,
  rootValue: schema,
  graphiql: true,
}));
app.post('/query', graphql({
  schema,
  rootValue: schema,
  graphiql: false,
}));

app.listen(4000, () => {
  console.log('Running on localhost:4000');
});
