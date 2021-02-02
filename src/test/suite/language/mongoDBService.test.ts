import { before } from 'mocha';
import { CancellationTokenSource, CompletionItemKind, CompletionItem } from 'vscode-languageclient';
import chai from 'chai';
import { createConnection } from 'vscode-languageserver';
import fs from 'fs';
import path from 'path';

import MongoDBService, { languageServerWorkerFileName } from '../../../language/mongoDBService';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { TestStream } from '../stubs';

const expect = chai.expect;
const INCREASED_TEST_TIMEOUT = 5000;

suite('MongoDBService Test Suite', () => {
  const params = { connectionString: 'mongodb://localhost:27018' };

  test('the language server worker dependency bundle exists', () => {
    const languageServerModuleBundlePath = path.join(
      mdbTestExtension.testExtensionContext.extensionPath,
      'dist',
      languageServerWorkerFileName
    );

    // eslint-disable-next-line no-sync
    expect(fs.existsSync(languageServerModuleBundlePath)).to.equal(true);
  });

  suite('Extension path', () => {
    const up = new TestStream();
    const down = new TestStream();
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
        { codeToEvaluate: '1 + 1' },
        source.token
      );

      expect(result).to.be.equal(undefined);
    });

    test('catches error when _getCollectionsCompletionItems is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getCollectionsCompletionItems('testDB');

      expect(result).to.be.equal(false);
    });

    test('catches error when _getFieldsCompletionItems is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getFieldsCompletionItems('testDB', 'testCol');

      expect(result).to.be.equal(false);
    });
  });

  suite('Connect', () => {
    const up = new TestStream();
    const down = new TestStream();
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
    const up = new TestStream();
    const down = new TestStream();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._getDatabasesCompletionItems = (): void => {};
      testMongoDBService._getCollectionsCompletionItems = (): Promise<boolean> =>
        Promise.resolve(true);
      testMongoDBService._getFieldsCompletionItems = (): Promise<boolean> =>
        Promise.resolve(true);

      await testMongoDBService.connectToServiceProvider(params);
    });

    test('provide shell collection methods completion if global scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.test.',
        { line: 0, character: 8 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'find');

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
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'find');

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell collection methods completion if collection name is array like', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', 'db["test"].'].join('\n'),
        { line: 1, character: 11 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'find');

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
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'find');

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell db methods completion with dot the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems('db.', {
        line: 0,
        character: 3
      });
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'getCollectionNames');

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
          character: 1
        }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'getCollectionNames');

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide shell db methods completion with dot after space', async () => {
      const result = await testMongoDBService.provideCompletionItems('db .', {
        line: 0,
        character: 4
      });
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'getCollectionNames');

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
      const aggCompletion = result.find((itme: CompletionItem) => itme.label === 'toArray');
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'allowPartialResults');

      expect(aggCompletion).to.have.property('kind', CompletionItemKind.Method);
      expect(findCompletion).to.be.undefined;
    });

    test('provide shell find cursor methods completion without args', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find().',
        { line: 0, character: 21 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'allowPartialResults');

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
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'allowPartialResults');

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
          '}).}'
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'allowPartialResults');

      expect(findCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide fields completion if has db, connection and is object key', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j});',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if text not formatted', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test");db.collection.find({j});',
        { line: 0, character: 33 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if functions are multi-lined', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
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
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object is multi-lined', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.collection.find({', '  j', '});'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if object key is surrounded by spaces', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j });',
        { line: 0, character: 35 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper db', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);
      testMongoDBService._updateCurrentSessionFields('second.collection', [
        {
          label: 'TypeScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("first"); use("second"); db.collection.find({ t});',
        { line: 0, character: 51 }
      );

      const jsCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');
      const tsCompletion = result.find((itme: CompletionItem) => itme.label === 'TypeScript');

      expect(jsCompletion).to.be.undefined;
      expect(tsCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if function scope', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); const name = () => { db.collection.find({ j}); }',
        { line: 0, character: 56 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion if snippets mode', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.aggregate([ { $match: { j} } ])',
        { line: 0, character: 52 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion for proper collection', async () => {
      testMongoDBService._updateCurrentSessionFields('test.firstCollection', [
        {
          label: 'JavaScript First',
          kind: CompletionItemKind.Field
        }
      ]);
      testMongoDBService._updateCurrentSessionFields('test.secondCollection', [
        {
          label: 'JavaScript Second',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.firstCollection.find({ j});',
        { line: 0, character: 40 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript First');

      expect(findCompletion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('do not provide fields completion if has not db', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ j});',
        { line: 0, character: 22 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.be.undefined;
    });

    test('do not provide fields completion if not object id', async () => {
      testMongoDBService._updateCurrentSessionFields('test.collection', [
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Field
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection(j);',
        { line: 0, character: 28 }
      );
      const findCompletion = result.find((itme: CompletionItem) => itme.label === 'JavaScript');

      expect(findCompletion).to.be.undefined;
    });

    test('provide db names completion for literal', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
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

    test('provide db names completion for template start line', async () => {
      testMongoDBService._updateCurrentSessionDatabases([
        {
          label: 'admin',
          kind: CompletionItemKind.Value
        }
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
          kind: CompletionItemKind.Value
        }
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
          kind: CompletionItemKind.Value
        }
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
        { name: 'empty' }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.',
        { line: 0, character: 16 }
      );
      const findCollectionCompletion = result.find((itme: CompletionItem) => itme.label === 'empty');

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion for object names with dashes', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'coll-name'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find((itme: CompletionItem) => itme.label === 'coll-name');

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
        { name: 'cocktailbars' }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('berlin');", '', 'let a = db.'].join('\n'),
        { line: 2, character: 11 }
      );
      const findCollectionCompletion = result.find((itme: CompletionItem) => itme.label === 'cocktailbars');

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
          name: 'coll-name'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db.",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find((itme: CompletionItem) => itme.label === 'coll-name');
      const findShellCompletion = result.find((itme: CompletionItem) => itme.label === 'getCollectionNames');

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
    });

    test('provide only collection names and shell db symbol completion after find cursor', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktailbars'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        [
          "use('berlin');",
          '',
          'let a = db.cocktailbars.find({}).toArray();',
          '',
          'db.'
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCollectionCompletion = result.find((itme: CompletionItem) => itme.label === 'cocktailbars');
      const findShellCompletion = result.find((itme: CompletionItem) => itme.label === 'getCollectionNames');
      const findCursorCompletion = result.find((itme: CompletionItem) => itme.label === 'toArray');

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
      expect(findCursorCompletion).to.be.undefined;
    });

    test('provide only collection names and shell db symbol completion after aggregate cursor', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktailbars'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        [
          "use('berlin');",
          '',
          'let a = db.cocktailbars.aggregate({}).toArray();',
          '',
          'db.'
        ].join('\n'),
        { line: 4, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'cocktailbars'
      );
      const findShellCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'getCollectionNames'
      );
      const findCursorCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'toArray'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
      expect(findShellCompletion).to.have.property(
        'kind',
        CompletionItemKind.Method
      );
      expect(findCursorCompletion).to.be.undefined;
    });

    test('provide only collection names completion in the middle of expression', async () => {
      testMongoDBService._updateCurrentSessionCollections('berlin', [
        {
          name: 'cocktails'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db..find().close()",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'cocktails'
      );
      const findShellCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'getCollectionNames'
      );
      const findCursorCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'close'
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
          name: 'coll-name'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        "use('berlin'); db..find()",
        { line: 0, character: 18 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'coll-name'
      );

      expect(findCollectionCompletion)
        .to.have.property('textEdit')
        .that.has.property('newText', "use('berlin'); db['coll-name'].find()");
    });

    test('provide collection names completion after single line comment', async () => {
      testMongoDBService._updateCurrentSessionCollections('test', [
        {
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '// Comment', 'db.'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '// Comment\\n', 'db.'].join('\n'),
        { line: 3, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', '/*', ' * Comment', '*/', 'db.'].join('\n'),
        { line: 5, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test'); // Comment", '', 'db.'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", '', 'db. /*', '* Comment', '*/'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', '/*', '  * Comment', '*/ db.'].join('\n'),
        { line: 4, character: 6 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', 'db. // Comment'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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
          name: 'collection'
        }
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        ["use('test')", '', 'db.'].join('\n'),
        { line: 2, character: 3 }
      );
      const findCollectionCompletion = result.find(
        (itme: CompletionItem) => itme.label === 'collection'
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

    const up = new TestStream();
    const down = new TestStream();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._extensionPath = mdbTestExtension.testExtensionContext.extensionPath;
      await testMongoDBService.connectToServiceProvider(params);
    });

    test('evaluate should sum numbers', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: '1 + 1'
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: { namespace: null, type: 'number', content: 2 }
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate multiplies commands at once', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 1; x + 2'
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: { namespace: null, type: 'number', content: 3 }
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('create each time a new runtime', async () => {
      const source = new CancellationTokenSource();
      const firstEvalResult = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 1 + 1; x'
        },
        source.token
      );
      const firstRes = {
        outputLines: [],
        result: { namespace: null, type: 'number', content: 2 }
      };

      expect(firstEvalResult).to.deep.equal(firstRes);

      const secondEvalResult = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'const x = 2 + 1; x'
        },
        source.token
      );
      const secondRes = {
        outputLines: [],
        result: { namespace: null, type: 'number', content: 3 }
      };

      expect(secondEvalResult).to.deep.equal(secondRes);
    });

    test('evaluate returns valid EJSON', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: `const { ObjectId } = require('bson');
          const x = { _id: new ObjectId('5fb292760ece2dc9c0362075') };
          x`
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
              $oid: '5fb292760ece2dc9c0362075'
            }
          }
        }
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns single line strings', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: `const x = 'A single line string';
          x`
        },
        source.token
      );
      const expectedResult = {
        outputLines: [],
        result: {
          namespace: null,
          type: 'string',
          content: 'A single line string'
        }
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('evaluate returns multiline strings', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: `const x = \`vscode
          is
          awesome\`;
          x`
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
          awesome`
        }
      };

      expect(result).to.deep.equal(expectedResult);
    });

    test('includes results from print() and console.log()', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.executeAll(
        {
          codeToEvaluate: 'print("Hello"); console.log(1,2,3); 42'
        },
        source.token
      );
      const expectedResult = {
        outputLines: [
          { namespace: null, type: null, content: 'Hello' },
          { namespace: null, type: null, content: 1 },
          { namespace: null, type: null, content: 2 },
          { namespace: null, type: null, content: 3 }
        ],
        result: { namespace: null, type: 'number', content: 42 }
      };

      expect(result).to.deep.equal(expectedResult);
    });
  });
});
