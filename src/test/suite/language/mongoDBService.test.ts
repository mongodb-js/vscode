import * as vscode from 'vscode';
import { before } from 'mocha';
import {
  CancellationTokenSource,
  CompletionItemKind,
  CompletionItem,
} from 'vscode-languageclient/node';
import chai from 'chai';
import { createConnection } from 'vscode-languageserver/node';
import fs from 'fs';
import path from 'path';

import MongoDBService, {
  languageServerWorkerFileName,
} from '../../../language/mongoDBService';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { StreamStub } from '../stubs';
import READ_PREFERENCES from '../../../views/webview-app/connection-model/constants/read-preferences';

const expect = chai.expect;
const INCREASED_TEST_TIMEOUT = 5000;

suite('MongoDBService Test Suite', () => {
  const params = {
    connectionId: 'pineapple',
    connectionString: 'mongodb://localhost:27018',
    connectionOptions: {
      readPreference: READ_PREFERENCES.PRIMARY,
    },
  };

  test('the language server worker dependency bundle exists', async () => {
    const languageServerModuleBundlePath = path.join(
      mdbTestExtension.extensionContextStub.extensionPath,
      'dist',
      languageServerWorkerFileName
    );
    await fs.promises.stat(languageServerModuleBundlePath);
  });

  suite('Extension path', () => {
    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._extensionPath = '';
      await testMongoDBService.connectToServiceProvider(params);
    });

    test('catches error when executeAll is called and extension path is empty string', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: '1 + 1',
          connectionId: 'pineapple',
        },
        source.token
      );

      expect(result).to.be.equal(undefined);
    });

    test('catches error when _getCollectionsCompletionItems is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getCollectionsCompletionItems(
        'testDB'
      );

      expect(result).to.be.equal(false);
    });

    test('catches error when _getFieldsCompletionItems is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getFieldsCompletionItems(
        'testDB',
        'testCol'
      );

      expect(result).to.be.equal(false);
    });
  });

  suite('Connect', () => {
    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    test('connect and disconnect from cli service provider', async () => {
      await testMongoDBService.connectToServiceProvider(params);

      expect(testMongoDBService.connectionString).to.be.equal(
        'mongodb://localhost:27018'
      );

      testMongoDBService.disconnectFromServiceProvider();

      expect(testMongoDBService.connectionString).to.be.undefined;
      expect(testMongoDBService.connectionOptions).to.be.undefined;
    });
  });

  suite('Complete', () => {
    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._getDatabasesCompletionItems = (): void => {};
      testMongoDBService._getCollectionsCompletionItems =
        (): Promise<boolean> => Promise.resolve(true);
      testMongoDBService._getFieldsCompletionItems = (): Promise<boolean> =>
        Promise.resolve(true);

      await testMongoDBService.connectToServiceProvider(params);
    });

    test('provide shell collection methods completion if global scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.test.',
        { line: 0, character: 8 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell collection methods completion if function scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'const name = () => { db.test. }',
        { line: 0, character: 29 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell collection methods completion if collection name is computed property', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', 'db["test"].'].join('\n'),
        { line: 1, character: 11 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell collection methods completion if single quotes', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", "db['test']."].join('\n'),
        { line: 1, character: 11 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell db methods completion with dot the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems('db.', {
        line: 0,
        character: 3,
      });
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell db methods completion with dot next line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['db', '.'].join('\n'),
        {
          line: 1,
          character: 1,
        }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell db methods completion with dot after space', async () => {
      const result = await testMongoDBService.provideCompletionItems('db .', {
        line: 0,
        character: 4,
      });
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell aggregation cursor methods completion', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate().',
        { line: 0, character: 26 }
      );
      const aggCompletion = result.find(
        (item: CompletionItem) => item.label === 'toArray'
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(aggCompletion).to.have.property('kind', CompletionItemKind.Method);
      expect(findCompletion).to.be.undefined;
    });

    test('provide shell find cursor methods completion without args', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find().',
        { line: 0, character: 21 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell find cursor methods completion with args at the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("companies");', '', 'db.companies.find({ blog_feed_url}).'].join(
          '\n'
        ),
        { line: 2, character: 36 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell find cursor methods completion with args next line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        [
          'use("companies");',
          '',
          'const name = () => { db.companies.find({',
          '  blog_feed_url',
          '}).}',
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide fields completion if has db, connection and is object key', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j});',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if text not formatted', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test");db.collection.find({j});',
        { line: 0, character: 33 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if functions are multi-lined', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        [
          'use("test");',
          'const name = () => {',
          '  db.collection.find({ j});',
          '}',
        ].join('\n'),
        { line: 2, character: 24 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object is multi-lined', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.collection.find({', '  j', '});'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object key is surrounded by spaces', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j });',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper db', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);
      testMongoDBService._updateCurrentSessionFields('second.collection', [
        {
          label: 'TypeScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("first"); use("second"); db.collection.find({ t});',
        { line: 0, character: 51 }
      );

      const jsCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );
      const tsCompletion = result.find(
        (item: CompletionItem) => item.label === 'TypeScript'
      );

      expect(jsCompletion).to.be.undefined;
      expect(tsCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if function scope', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); const name = () => { db.collection.find({ j}); }',
        { line: 0, character: 56 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if snippets mode', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.aggregate([ { $match: { j} } ])',
        { line: 0, character: 52 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper collection', async () => {
      testMongoDBService._updateCurrentSessionFields('test.firstCollection', [
        {
          label: 'JavaScript First',
          kind: CompletionItemKind.Field,
        },
      ]);
      testMongoDBService._updateCurrentSessionFields('test.secondCollection', [
        {
          label: 'JavaScript Second',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.firstCollection.find({ j});',
        { line: 0, character: 40 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript First'
      );

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('do not provide fields completion if has not db', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ j});',
        { line: 0, character: 22 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if not object id', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection(j);',
        { line: 0, character: 28 }
      );
      const findCompletion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(findCompletion).to.be.undefined;
    });

    test('provide db names completion for literal', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value,
        },
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

    test('provide db names completion for template start line', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 0, character: 5 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Value);
    });

    test('provide db names completion for template middle line', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 1, character: 0 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Value);
    });

    test('provide db names completion for template end line', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value,
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 2, character: 0 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Value);
    });

    test('provide collection names completion for valid object names', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        { name: 'empty' },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.',
        { line: 0, character: 16 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'empty'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion for object names with dashes', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );

      expect(findCollectionCompletion)
        .to.have.property('textEdit')
        .that.has.property('newText', "use('berlin'); db['coll-name']");
    });

    test('provide collection names completion in variable declarations', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        { name: 'cocktailbars' },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('berlin');", '', 'let a = db.'].join('\n'),
        { line: 2, character: 11 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'cocktailbars'
      );

      expect(findCollectionCompletion).to.have.property(
        'label',
        'cocktailbars'
      );
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names and shell db symbol completion for db symbol', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );
      const findShellCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
      expect(findShellCompletion).to.have.property('documentation');
      expect(findShellCompletion).to.have.property('detail');
    });

    test('provide only collection names and shell db symbol completion after find cursor', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktailbars',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        [
          "use('berlin');",
          '',
          'let a = db.cocktailbars.find({}).toArray();',
          '',
          'db.',
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'cocktailbars'
      );
      const findShellCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );
      const findCursorCompletion = result.find(
        (item: CompletionItem) => item.label === 'toArray'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
      expect(findShellCompletion).to.have.property('documentation');
      expect(findShellCompletion).to.have.property('detail');
      expect(findCursorCompletion).to.be.undefined;
    });

    test('provide only collection names and shell db symbol completion after aggregate cursor', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktailbars',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        [
          "use('berlin');",
          '',
          'let a = db.cocktailbars.aggregate({}).toArray();',
          '',
          'db.',
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'cocktailbars'
      );
      const findShellCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );
      const findCursorCompletion = result.find(
        (item: CompletionItem) => item.label === 'toArray'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
      expect(findShellCompletion).to.have.property('documentation');
      expect(findShellCompletion).to.have.property('detail');
      expect(findCursorCompletion).to.be.undefined;
    });

    test('provide only collection names completion in the middle of expression', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktails',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db..find().close()",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'cocktails'
      );
      const findShellCompletion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );
      const findCursorCompletion = result.find(
        (item: CompletionItem) => item.label === 'close'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.be.undefined;
      expect(findCursorCompletion).to.be.undefined;
    });

    test('provide collection names with dashes completion in the middle of expression', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db..find()",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion)
        .to.have.property('textEdit')
        .that.has.property('newText', "use('berlin'); db['coll-name'].find()");
    });

    test('provide collection names completion after single line comment', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '// Comment', 'db.'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion after single line comment with new line character', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '// Comment\\n', 'db.'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion after multi-line comment', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '/*', ' * Comment', '*/', 'db.'].join('\n'),
        { line: 5, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion after end of line comment', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test'); // Comment", '', 'db.'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion at the same line block comment starts', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', 'db. /*', '* Comment', '*/'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion at the same line block comment ends', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', '/*', '  * Comment', '*/ db.'].join('\n'),
        { line: 4, character: 6 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion at the same line with end line comment', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', 'db. // Comment'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion if code without a semicolon', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection',
        },
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', 'db.'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'collection'
      );

      expect(findCollectionCompletion).to.have.property('label', 'collection');
      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });
  });

  suite('Evaluate', function () {
    this.timeout(INCREASED_TEST_TIMEOUT);

    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._extensionPath =
        mdbTestExtension.extensionContextStub.extensionPath;
      await testMongoDBService.connectToServiceProvider(params);
    });

    test('evaluate should sum numbers', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: '1 + 1',
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'number',
          content: 2,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('should not run when the connectionId does not match', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'not pineapple',
          codeToEvaluate: '1 + 1',
        },
        source.token
      );

      expect(result).to.equal(undefined);
    });

    test('evaluate multiplies commands at once', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'const x = 1; x + 2',
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'number',
          content: 3,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('create each time a new runtime', async () => {
      const source = new CancellationTokenSource();
      const firstEvalResult = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'const x = 1 + 1; x',
        },
        source.token
      );
      const firstRes = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'number',
          content: 2,
          language: 'plaintext',
        },
      };

      expect(firstEvalResult).to.deep.equal(firstRes);

      const secondEvalResult = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'const x = 2 + 1; x',
        },
        source.token
      );
      const secondRes = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'number',
          content: 3,
          language: 'plaintext',
        },
      };

      expect(secondEvalResult).to.deep.equal(secondRes);
    });

    test('evaluate returns valid EJSON', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: `const { ObjectId } = require('bson');
          const x = { _id: new ObjectId('5fb292760ece2dc9c0362075') };
          x`,
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'object',
          content: {
            _id: {
              $oid: '5fb292760ece2dc9c0362075',
            },
          },
          language: 'json',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns an object', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: `const obj = { name: "a short string" };
          obj`,
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'object',
          content: {
            name: 'a short string',
          },
          language: 'json',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns an array', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: `const arr = [{ name: "a short string" }];
          arr`,
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'object',
          content: [
            {
              name: 'a short string',
            },
          ],
          language: 'json',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns undefined', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'undefined',
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'undefined',
          content: undefined,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns null', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'null',
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'object',
          content: null,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns single line strings', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: `const x = 'A single line string';
          x`,
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'string',
          content: 'A single line string',
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns multiline strings', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: `const x = \`vscode
          is
          awesome\`;
          x`,
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'string',
          content: `vscode
          is
          awesome`,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('includes results from print() and console.log()', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          connectionId: 'pineapple',
          codeToEvaluate: 'print("Hello"); console.log(1,2,3); 42',
        },
        source.token
      );
      const expectedResult = {
        outputLines: [
          { namespace: null, type: null, content: 'Hello', language: null },
          { namespace: null, type: null, content: 1, language: null },
          { namespace: null, type: null, content: 2, language: null },
          { namespace: null, type: null, content: 3, language: null },
        ],
        result: {
          namespace: null,
          type: 'number',
          content: 42,
          language: 'plaintext',
        },
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });

  suite('getExportToLanguageMode', function () {
    this.timeout(INCREASED_TEST_TIMEOUT);

    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    test('returns other for call expression', () => {
      const textFromEditor = `db.sales.insertMany([
        { '_id': 1, 'item': 'abc', 'price': 10, 'quantity': 2, 'date': new Date('2014-03-01T08:00:00Z') },
        { '_id': 2, 'item': 'jkl', 'price': 20, 'quantity': 1, 'date': new Date('2014-03-01T09:00:00Z') },
        { '_id': 3, 'item': 'xyz', 'price': 5, 'quantity': 10, 'date': new Date('2014-03-15T09:00:00Z') },
        { '_id': 4, 'item': 'xyz', 'price': 5, 'quantity':  20, 'date': new Date('2014-04-04T11:21:39.736Z') },
        { '_id': 5, 'item': 'abc', 'price': 10, 'quantity': 10, 'date': new Date('2014-04-04T21:23:13.331Z') },
        { '_id': 6, 'item': 'def', 'price': 7.5, 'quantity': 5, 'date': new Date('2015-06-04T05:08:13Z') },
        { '_id': 7, 'item': 'def', 'price': 7.5, 'quantity': 10, 'date': new Date('2015-09-10T08:43:00Z') },
        { '_id': 8, 'item': 'abc', 'price': 10, 'quantity': 5, 'date': new Date('2016-02-06T20:20:13Z') },
      ]);`;
      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 9, character: 3 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('OTHER');
    });

    test('returns query for an object', () => {
      const textFromEditor =
        "db.sales.insertMany([{ '_id': 1, 'item': 'abc', 'price': 10, 'quantity': 2, 'date': new Date('2014-03-01T08:00:00Z') }]);";
      const selection = {
        start: { line: 0, character: 21 },
        end: { line: 0, character: 118 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('QUERY');
    });

    test('returns aggregation for an array as function argument', () => {
      const textFromEditor =
        "db.sales.insertMany([{ '_id': 1, 'item': 'abc', 'price': 10, 'quantity': 2, 'date': new Date('2014-03-01T08:00:00Z') }]);";
      const selection = {
        start: { line: 0, character: 20 },
        end: { line: 0, character: 119 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('AGGREGATION');
    });

    test('returns query for an object as function argument', () => {
      const textFromEditor =
        "db.sales.insertMany({ '_id': 1, 'item': 'abc' });";
      const selection = {
        start: { line: 0, character: 20 },
        end: { line: 0, character: 47 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('QUERY');
    });

    test('returns aggregation for an array assigned to a variable', () => {
      const textFromEditor = "const arr = [{ '_id': 1, 'item': 'abc' }];";
      const selection = {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 41 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('AGGREGATION');
    });

    test('returns query for an object assigned to a variable', () => {
      const textFromEditor = "const obj = { '_id': 1 };";
      const selection = {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('QUERY');
    });

    test('returns other for a variable declaration', () => {
      const textFromEditor = "const arr = [{ '_id': 1, 'item': 'abc' }];";
      const selection = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 42 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('OTHER');
    });

    test('returns query for an object used as another object property', () => {
      const textFromEditor =
        "const obj = { prop: { '_id': 1, 'item': 'abc' } };";
      const selection = {
        start: { line: 0, character: 20 },
        end: { line: 0, character: 47 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('QUERY');
    });

    test('returns aggregation for an array inside another array', () => {
      const textFromEditor = 'const arr = [[]];';
      const selection = {
        start: { line: 0, character: 13 },
        end: { line: 0, character: 15 },
      } as vscode.Selection;

      const mode = testMongoDBService.getExportToLanguageMode({
        textFromEditor,
        selection,
      });

      expect(mode).to.be.equal('AGGREGATION');
    });
  });
});
