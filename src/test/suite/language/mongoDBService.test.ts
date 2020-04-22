import MongoDBService from '../../../language/mongoDBService';

const chai = require('chai');
const expect = chai.expect;

suite('MongoDBService Test Suite', () => {
  test('provide shell API symbols/methods completion', async () => {
    const connection = { console: { log: () => {} } };
    const testMongoDBService = new MongoDBService(connection);

    await testMongoDBService.connectToServiceProvider({
      connectionString: 'mongodb://localhost:27018',
      connectionOptions: {}
    });

    const result = await testMongoDBService.provideCompletionItems('db.test.');
    const findCompletion = result.find(
      (itme: { label: string; kind: number }) => itme.label === 'find'
    );

    expect(findCompletion).to.have.property('label', 'find');
    expect(findCompletion).to.have.property('kind', 1);
  });

  test('connect and disconnect from cli service provider', async () => {
    const connection = { console: { log: () => {} } };
    const testMongoDBService = new MongoDBService(connection);

    await testMongoDBService.connectToServiceProvider({
      connectionString: 'mongodb://localhost:27018',
      connectionOptions: {}
    });

    expect(testMongoDBService.connectionString).to.be.equal(
      'mongodb://localhost:27018'
    );
    expect(testMongoDBService.connectionOptions).to.be.deep.equal({});

    await testMongoDBService.disconnectFromServiceProvider();

    expect(testMongoDBService.connectionString).to.be.undefined;
    expect(testMongoDBService.connectionOptions).to.be.undefined;
  });

  test('do not provide shell completion when disconnected', async () => {
    const connection = { console: { log: () => {} } };
    const testMongoDBService = new MongoDBService(connection);

    await testMongoDBService.connectToServiceProvider({
      connectionString: 'mongodb://localhost:27018',
      connectionOptions: {}
    });
    await testMongoDBService.disconnectFromServiceProvider();

    const result = await testMongoDBService.provideCompletionItems('db.test.');
    const findCompletion = result.find(
      (itme: { label: string; kind: number }) => itme.label === 'find'
    );

    expect(testMongoDBService.connectionString).to.be.undefined;
    expect(testMongoDBService.connectionOptions).to.be.undefined;
    expect(findCompletion).to.be.undefined;
  });
});
