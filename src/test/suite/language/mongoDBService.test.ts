import {
  CancellationTokenSource,
  CompletionItemKind
} from 'vscode-languageclient';
import { before } from 'mocha';

const chai = require('chai');
const path = require('path');
const fs = require('fs');

import MongoDBService, { languageServerWorkerFileName } from '../../../language/mongoDBService';

import { mdbTestExtension } from '../stubbableMdbExtension';

const expect = chai.expect;

const INCREASED_TEST_TIMEOUT = 5000;

suite('MongoDBService Test Suite', () => {
  const connection = {
    console: { log: (): void => {} },
    sendRequest: (): void => {},
    sendNotification: (): void => {}
  };
  const params = {
    connectionString: 'mongodb://localhost:27018',
    extensionPath: mdbTestExtension.testExtensionContext.extensionPath
  };

  test('the language server worker dependency bundle exists', () => {
    const languageServerModuleBundlePath = path.join(
      mdbTestExtension.testExtensionContext.extensionPath,
      'dist',
      languageServerWorkerFileName
    );

    // eslint-disable-next-line no-sync
    expect(fs.existsSync(languageServerModuleBundlePath)).to.equal(true);
  });

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

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if function scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'const name = () => { db.test. }',
        { line: 0, character: 29 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if object is written as literal', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', 'db["test"].'].join('\n'),
        { line: 1, character: 11 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if single quotes', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", "db['test']."].join('\n'),
        { line: 1, character: 11 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if db symbol', async () => {
      const result = await testMongoDBService.provideCompletionItems('db.', {
        line: 0,
        character: 3
      });
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'getCollectionNames'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if aggregation cursor', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate().',
        { line: 0, character: 26 }
      );
      const aggCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'toArray'
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'allowPartialResults'
      );

      expect(aggCompletion).to.have.property('kind', CompletionItemKind.Method);
      expect(findCompletion).to.be.undefined;
    });

    test('provide shell API symbols/methods completion if find cursor without args', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find().',
        { line: 0, character: 21 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if find cursor with args at the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("companies");', '', 'db.companies.find({ blog_feed_url}).'].join(
          '\n'
        ),
        { line: 2, character: 36 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell API symbols/methods completion if find cursor with args below', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        [
          'use("companies");',
          '',
          'const name = () => { db.companies.find({',
          '  blog_feed_url',
          '}).}'
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide fields completion if has db, connection and is object key', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j});',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if text not formatted', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test");db.collection.find({j});',
        { line: 0, character: 33 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if functions are multi-lined', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

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

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object is multi-lined', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.collection.find({', '  j', '});'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object key is surrounded by spaces', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j });',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper db', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);
      testMongoDBService.updateCurrentSessionFields('second.collection', [
        {
          label: 'TypeScript',
          kind: CompletionItemKind.Field
        }
      ]);

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
      expect(tsCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if function scope', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); const name = () => { db.collection.find({ j}); }',
        { line: 0, character: 56 }
      );

      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if snippets mode', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.aggregate([ { $match: { j} } ])',
        { line: 0, character: 52 }
      );

      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper collection', async () => {
      testMongoDBService.updateCurrentSessionFields('test.firstCollection', [
        {
          label: 'JavaScript First',
          kind: CompletionItemKind.Field
        }
      ]);
      testMongoDBService.updateCurrentSessionFields('test.secondCollection', [
        {
          label: 'JavaScript Second',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.firstCollection.find({ j});',
        { line: 0, character: 40 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) =>
          itme.label === 'JavaScript First'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('do not provide fields completion if has not db', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ j});',
        { line: 0, character: 22 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if not object id', async () => {
      testMongoDBService.updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection(j);',
        { line: 0, character: 28 }
      );
      const findCompletion = result.find(
        (itme: { label: string; kind: number }) => itme.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('provide db names completion', async () => {
      testMongoDBService.updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("a");',
        { line: 0, character: 6 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Value);
    });

    test('provide collection names completion for valid object names', async () => {
      testMongoDBService.updateCurrentSessionCollections('test', [
        { name: 'empty' }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.',
        { line: 0, character: 16 }
      );
      const findCollectionCompletion = result.find(
        (itme: any) => itme.label === 'empty'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Property
      );
    });

    test('provide collection names completion for object names with dashes', async () => {
      testMongoDBService.updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (itme: any) => itme.label === 'coll-name'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Property
      );

      expect(findCollectionCompletion)
        .to.have.property('textEdit')
        .that.has.property('newText', "db['coll-name']");
    });

    test('provide collection names and shell db symbol completion', async () => {
      testMongoDBService.updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (itme: any) => itme.label === 'coll-name'
      );
      const findShellCompletion = result.find(
        (itme: any) => itme.label === 'getCollectionNames'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Property
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
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
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: '1 + 1'
        },
        source.token
      );

      expect(result).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 1; x + 2'
        },
        source.token
      );

      expect(result).to.be.equal('3');
    });

    test('create each time a new runtime', async function () {
      this.timeout(INCREASED_TEST_TIMEOUT);

      const source = new CancellationTokenSource();
      const firstEvalResult = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 1 + 1; x'
        },
        source.token
      );

      expect(firstEvalResult).to.be.equal('2');

      const secondEvalResult = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 2 + 1; x'
        },
        source.token
      );

      expect(secondEvalResult).to.be.equal('3');
    });
  });
});
