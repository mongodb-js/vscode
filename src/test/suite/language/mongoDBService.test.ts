import MongoDBService from '../../../language/mongoDBService';
import { CancellationTokenSource } from 'vscode-languageclient';
import { before } from 'mocha';

const chai = require('chai');
const expect = chai.expect;

const INCREASED_TEST_TIMEOUT = 5000;

suite('MongoDBService Test Suite', () => {
  const connection = {
    console: { log: () => {} },
    sendRequest: () => {},
    sendNotification: () => {}
  };
  const params = {
    connectionString: 'mongodb://localhost:27018'
  };

  suite('Connect', () => {
    test('connect and disconnect from cli service provider', async () => {
      const testMongoDBService = new MongoDBService(connection);

      await testMongoDBService.connectToServiceProvider(params);

      expect(testMongoDBService.connectionString).to.be.equal(
        'mongodb://localhost:27018'
      );

      await testMongoDBService.disconnectFromServiceProvider();

      expect(testMongoDBService.connectionString).to.be.undefined;
      expect(testMongoDBService.connectionOptions).to.be.undefined;
    });
  });

  suite('Complete', () => {
    let testMongoDBService: MongoDBService;

    before(async () => {
      testMongoDBService = new MongoDBService(connection);

      await testMongoDBService.connectToServiceProvider(params);
    });

    test('provide shell API symbols/methods completion if global scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.test.',
        { line: 0, character: 8 }
      );

      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide shell API symbols/methods completion if function scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'const name = () => { db.test. }',
        { line: 0, character: 29 }
      );

      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if has db, connection and is object key', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j});',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if text not formatted', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test");db.collection.find({j});',
        { line: 0, character: 33 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if functions are multi-lined', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        [
          'use("test");',
          'const name = () => {',
          '  db.collection.find({ j});',
          '}'
        ].join('\n'),
        { line: 2, character: 24 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if object is multi-lined', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.collection.find({', '  j', '});'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if object key is surrounded by spaces', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j });',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion for proper db', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'first.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ],
        'second.collection': [
          {
            label: 'TypeScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("first"); use("second"); db.collection.find({ t});',
        { line: 0, character: 51 }
      );

      const jsCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );
      const tsCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'TypeScript'
      );

      expect(jsCompletion).to.be.undefined;
      expect(tsCompletion).to.have.property('kind', 1);
    });

    test('provide fields completion if function scope', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); const name = () => { db.collection.find({ j}); }',
        { line: 0, character: 56 }
      );

      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', 1);
    });

    test('do not provide fields completion if has not db', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ j});',
        { line: 0, character: 22 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if has wrong db', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("other"); db.collection.find({ j});',
        { line: 0, character: 36 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if has wrong collection', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.test.find({ j});',
        { line: 0, character: 29 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if not object id', async () => {
      testMongoDBService.updatedCurrentSessionFields({
        'test.collection': [
          {
            label: 'JavaScript',
            kind: 1
          }
        ]
      });

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection(j);',
        { line: 0, character: 28 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide shell completion if disconnected', async () => {
      await testMongoDBService.disconnectFromServiceProvider();

      const result = await testMongoDBService.provideCompletionItems(
        'db.test.',
        { line: 0, character: 8 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(testMongoDBService.connectionString).to.be.undefined;
      expect(testMongoDBService.connectionOptions).to.be.undefined;
      expect(findCompletion).to.be.undefined;
    });
  });

  suite('Evaluate', () => {
    let testMongoDBService: MongoDBService;

    before(async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      testMongoDBService = new MongoDBService(connection);

      await testMongoDBService.connectToServiceProvider(params);
    });

    test('evaluate should sum numbers', async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll('1 + 1', source.token);

      expect(result).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        'const x = 1; x + 2',
        source.token
      );

      expect(result).to.be.equal('3');
    });

    test('create each time a new runtime', async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      const source = new CancellationTokenSource();
      const firstEvalResult = await testMongoDBService.executeAll(
        'const x = 1 + 1; x',
        source.token
      );

      expect(firstEvalResult).to.be.equal('2');

      const secondEvalResult = await testMongoDBService.executeAll(
        'const x = 2 + 1; x',
        source.token
      );

      expect(secondEvalResult).to.be.equal('3');
    });
  });
});
