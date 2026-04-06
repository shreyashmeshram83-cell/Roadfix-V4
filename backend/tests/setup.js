const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

let mongoServer;
let usingExternalMongo = false;

jest.setTimeout(30000);

beforeAll(async () => {
  const externalUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI;
  let uri = externalUri;

  if (externalUri) {
    usingExternalMongo = true;
  } else {
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();
  }

  await mongoose.connect(uri);
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  if (mongoServer && !usingExternalMongo) {
    await mongoServer.stop();
  }
});
