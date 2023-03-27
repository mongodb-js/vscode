import * as vscode from 'vscode';
import { before } from 'mocha';
import {
  CancellationTokenSource,
  CompletionItemKind,
  InsertTextFormat,
  DiagnosticSeverity,
  MarkupContent,
} from 'vscode-languageclient/node';
import type { CompletionItem } from 'vscode-languageclient/node';
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
import DIAGNOSTIC_CODES from '../../../language/diagnosticCodes';

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

    test('catches error when evaluate is called and extension path is empty string', async () => {
      const source = new CancellationTokenSource();
      const result = await testMongoDBService.evaluate(
        {
          codeToEvaluate: '1 + 1',
          connectionId: 'pineapple',
        },
        source.token
      );

      expect(result).to.be.equal(undefined);
    });

    test('catches error when _getCollectionsCompletionItems is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getCollections('testDB');

      expect(result).to.be.deep.equal([]);
    });

    test('catches error when _getSchemaFields is called and extension path is empty string', async () => {
      const result = await testMongoDBService._getSchemaFields(
        'testDB',
        'testCol'
      );

      expect(result).to.be.deep.equal([]);
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

      await testMongoDBService.disconnectFromServiceProvider();

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
      testMongoDBService._getDatabases = (): Promise<Document[]> =>
        Promise.resolve([]);
      testMongoDBService._getCollections = (): Promise<Document[]> =>
        Promise.resolve([]);
      testMongoDBService._getSchemaFields = (): Promise<string[]> =>
        Promise.resolve([]);

      await testMongoDBService.connectToServiceProvider(params);
    });

    test('provide shell collection methods completion if global scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.test.',
        { line: 0, character: 8 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion if function scope', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'const name = () => { db.test. }',
        { line: 0, character: 29 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion for a collection name in a bracket notation', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', 'db["test"].'].join('\n'),
        { line: 1, character: 11 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion for a collection name in getCollection', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', 'db.getCollection("test").'].join('\n'),
        { line: 1, character: 41 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion if single quotes', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ["use('test');", "db['test']."].join('\n'),
        { line: 1, character: 11 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell db methods completion with dot the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems('db.', {
        line: 0,
        character: 3,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell db methods completion with dot next line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['db', '.'].join('\n'),
        {
          line: 1,
          character: 1,
        }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell db methods completion with dot after space', async () => {
      const result = await testMongoDBService.provideCompletionItems('db .', {
        line: 0,
        character: 4,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell aggregation cursor methods completion', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate().',
        { line: 0, character: 26 }
      );
      const aggCompletion = result.find(
        (item: CompletionItem) => item.label === 'toArray'
      );
      const otherCompletion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(aggCompletion?.kind).to.be.eql(CompletionItemKind.Method);
      expect(otherCompletion).to.be.undefined;
    });

    test('provide shell find cursor methods completion without args', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find().',
        { line: 0, character: 21 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell find cursor methods completion with args at the same line', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("companies");', '', 'db.companies.find({ blog_feed_url}).'].join(
          '\n'
        ),
        { line: 2, character: 36 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
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
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide fields completion in find in dot notation when has db', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j});',
        { line: 0, character: 35 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find in bracket notation when has db', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db["collection"].find({ j});',
        { line: 0, character: 38 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if text not formatted', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test");db.collection.find({j});',
        { line: 0, character: 33 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if functions are multi-lined', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        [
          'use("test");',
          'const name = () => {',
          '  db.collection.find({ j});',
          '}',
        ].join('\n'),
        { line: 2, character: 24 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if object is multi-lined', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.collection.find({', '  j', '});'].join('\n'),
        { line: 3, character: 3 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if a key is surrounded by spaces', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find({ j });',
        { line: 0, character: 35 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find for a proper db', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);
      testMongoDBService._cacheFields('second.collection', ['TypeScript']);

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

    test('provide fields completion in find inside function scope', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); const name = () => { db.collection.find({ j}); }',
        { line: 0, character: 56 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find for a proper collection', async () => {
      testMongoDBService._cacheFields('test.firstCollection', [
        'JavaScript First',
      ]);
      testMongoDBService._cacheFields('test.secondCollection', [
        'JavaScript Second',
      ]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.firstCollection.find({ j});',
        { line: 0, character: 40 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript First'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('do not provide fields completion in find if db not found', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ j});',
        { line: 0, character: 22 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.be.undefined;
    });

    test('do not provide fields completionin find outside object property', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.find(j);',
        { line: 0, character: 28 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.be.undefined;
    });

    test('provide fields completion in aggregate inside the $match stage', async () => {
      testMongoDBService._cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.aggregate([ { $match: { j} } ])',
        { line: 0, character: 52 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide stages completion in aggregate when has db', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'use("test"); db.collection.aggregate([{ $m}]);',
        { line: 0, character: 42 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$match'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Keyword);
      expect(completion).to.have.property('insertText');
      expect(completion).to.have.property(
        'insertTextFormat',
        InsertTextFormat.Snippet
      );

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide stages completion in aggregate if db not found', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $m}]);',
        { line: 0, character: 29 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$match'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide stages completion in find if object is multi-lined', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        ['use("test");', '', 'db.aggregate.find([{', '  $c', '}]);'].join('\n'),
        { line: 3, character: 4 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$count'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide query completion for the $match stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { $e} }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$expr'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Keyword);
      expect(completion).to.have.property('documentation');
    });

    test('provide query completion in find', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ $e});',
        { line: 0, character: 23 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$expr'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide query completion for other than $match stages', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $merge: { $e} }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$expr'
      );

      expect(completion).to.be.undefined;
    });

    test('provide bson completion in find', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ _id: O});',
        { line: 0, character: 27 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'ObjectId'
      );

      expect(completion).to.have.property(
        'kind',
        CompletionItemKind.Constructor
      );
      expect(completion).to.have.property('insertText');
      expect(completion).to.have.property(
        'insertTextFormat',
        InsertTextFormat.Snippet
      );

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide bson completion in aggregate', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { _id: O }}]);',
        { line: 0, character: 42 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === 'ObjectId'
      );

      expect(completion).to.have.property(
        'kind',
        CompletionItemKind.Constructor
      );
      expect(completion).to.have.property('insertText');
      expect(completion).to.have.property(
        'insertTextFormat',
        InsertTextFormat.Snippet
      );

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide system variable completion in find', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.find({ _id: "$$N" });',
        { line: 0, character: 30 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$$NOW'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Variable);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide system variable completion in aggregate', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { _id: "$$R" }}]);',
        { line: 0, character: 46 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$$ROOT'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Variable);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide field reference completion in find when has db', async () => {
      testMongoDBService._cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems(
        "use('test'); db.collection.find({ $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } });",
        { line: 0, character: 77 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('do not provide field reference completion in find if db not found', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        "db.collection.find({ $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } });",
        { line: 0, character: 64 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );

      expect(completion).to.be.undefined;
    });

    test('provide field reference completion in aggregate when has db', async () => {
      testMongoDBService._cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems(
        "use('test'); db.collection.aggregate({ $match: { $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } } });",
        { line: 0, character: 92 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('provide field reference completion in aggregate when collection is specified via getCollection', async () => {
      testMongoDBService._cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems(
        "use('test'); db.getCollection('collection').aggregate([{ $match: '$p' }]);",
        { line: 0, character: 68 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('provide aggregation expression completion for other than $match stages', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $project: { yearMonthDayUTC: { $d } } }]);',
        { line: 0, character: 59 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$dateToString'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide aggregation expression completion for the $match stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate({ $match: { $d } });',
        { line: 0, character: 38 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$dateToString'
      );

      expect(completion).to.be.undefined;
    });

    test('provide aggregation conversion completion for other than $match stages', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $project: { result: {$c} } }]);',
        { line: 0, character: 50 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$convert'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide aggregation conversion completion for the $match stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { $c } }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$convert'
      );

      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator completion for the $project stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $project: { revenue: { $a} } }]);',
        { line: 0, character: 52 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('provide aggregation accumulator completion for the $group stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $group: { _id: "$author", avgCopies: { $a} } }]);',
        { line: 0, character: 68 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide aggregation accumulator completion for the $match stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { $a } }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );

      expect(completion).to.be.undefined;
    });

    test('do not provide aggregation accumulator completion for the $documents stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $documents: { $a } }]);',
        { line: 0, character: 43 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );

      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator direction completion for the $project stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $project: { revenue: { $b} } }]);',
        { line: 0, character: 52 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('provide aggregation accumulator direction completion for the $group stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $group: { _id: "$author", avgCopies: { $b} } }]);',
        { line: 0, character: 68 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide aggregation accumulator direction completion for the $match stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $match: { $b } }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );

      expect(completion).to.be.undefined;
    });

    test('do not provide aggregation accumulator direction completion for the $documents stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $documents: { $b } }]);',
        { line: 0, character: 43 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );

      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator window completion for the $setWindowFields stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $setWindowFields: { partitionBy: "$state", output: { documentNumberForState: { $d} } } }]);',
        { line: 0, character: 108 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$documentNumber'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include(
        '[Documentation]'
      );
    });

    test('do not provide aggregation accumulator window completion for the $group stage', async () => {
      const result = await testMongoDBService.provideCompletionItems(
        'db.collection.aggregate([{ $group: { $d } }]);',
        { line: 0, character: 39 }
      );
      const completion = result.find(
        (item: CompletionItem) => item.label === '$documentNumber'
      );

      expect(completion).to.be.undefined;
    });

    test('provide db and use identifier completion', async () => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems('', {
        line: 0,
        character: 0,
      });

      const dbCompletion = result.find(
        (item: CompletionItem) => item.label === 'db'
      );
      expect(dbCompletion).to.have.property('label', 'db');
      expect(dbCompletion).to.have.property('kind', CompletionItemKind.Method);

      const useCompletion = result.find(
        (item: CompletionItem) => item.label === 'use'
      );
      expect(useCompletion).to.have.property('label', 'use');
      expect(useCompletion).to.have.property(
        'kind',
        CompletionItemKind.Function
      );
      expect(useCompletion).to.have.property(
        'documentation',
        'Switch current database.'
      );
      expect(useCompletion).to.have.property('detail', 'use(<databaseName>);');
    });

    test('provide db names completion for literal', async () => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems(
        'use("a");',
        { line: 0, character: 6 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template start line', async () => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 0, character: 5 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template middle line', async () => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 1, character: 0 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template end line', async () => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems(
        ['use(`', '', '`);'].join('\n'),
        { line: 2, character: 0 }
      );

      expect(result.length).to.be.equal(1);

      const db = result.shift();

      expect(db).to.have.property('label', 'admin');
      expect(db).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide collection names completion for valid object names', async () => {
      const textFromEditor = 'use("test"); db.';
      const position = { line: 0, character: 16 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'empty' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = "use('berlin'); db.";
      const position = { line: 0, character: 18 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = ["use('berlin');", '', 'let a = db.'].join('\n');
      const position = { line: 2, character: 11 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'cocktailbars' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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

    test('provide collection names completion for db symbol with bracket notation', async () => {
      const textFromEditor = "use('berlin'); db['']";
      const position = { line: 0, character: 19 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion for getCollection as a simple string', async () => {
      const textFromEditor = "use('berlin'); db.getCollection('')";
      const position = { line: 0, character: 33 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names completion for getCollection as a string template', async () => {
      const textFromEditor = "use('berlin'); db.getCollection(``)";
      const position = { line: 0, character: 33 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion).to.have.property(
        'kind',
        CompletionItemKind.Folder
      );
    });

    test('provide collection names and shell db symbol completion for db symbol with dot notation', async () => {
      const textFromEditor = "use('berlin'); db.";
      const position = { line: 0, character: 18 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );

      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = [
        "use('berlin');",
        '',
        'let a = db.cocktailbars.find({}).toArray();',
        '',
        'db.',
      ].join('\n');
      const position = { line: 4, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'cocktailbars' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = [
        "use('berlin');",
        '',
        'let a = db.cocktailbars.aggregate({}).toArray();',
        '',
        'db.',
      ].join('\n');
      const position = { line: 4, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'cocktailbars' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = "use('berlin'); db..find().close()";
      const position = { line: 0, character: 18 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'cocktails' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = "use('berlin'); db..find()";
      const position = { line: 0, character: 18 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'berlin',
        [{ name: 'coll-name' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
      );
      const findCollectionCompletion = result.find(
        (item: CompletionItem) => item.label === 'coll-name'
      );

      expect(findCollectionCompletion)
        .to.have.property('textEdit')
        .that.has.property('newText', "use('berlin'); db['coll-name'].find()");
    });

    test('provide collection names completion after single line comment', async () => {
      const textFromEditor = ["use('test');", '', '// Comment', 'db.'].join(
        '\n'
      );
      const position = { line: 3, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = ["use('test');", '', '// Comment\\n', 'db.'].join(
        '\n'
      );
      const position = { line: 3, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = [
        "use('test');",
        '',
        '/*',
        ' * Comment',
        '*/',
        'db.',
      ].join('\n');
      const position = { line: 5, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = ["use('test'); // Comment", '', 'db.'].join('\n');
      const position = { line: 2, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = [
        "use('test');",
        '',
        'db. /*',
        '* Comment',
        '*/',
      ].join('\n');
      const position = { line: 2, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = [
        "use('test')",
        '',
        '/*',
        '  * Comment',
        '*/ db.',
      ].join('\n');
      const position = { line: 4, character: 6 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = ["use('test')", '', 'db. // Comment'].join('\n');
      const position = { line: 2, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const textFromEditor = ["use('test')", '', 'db.'].join('\n');
      const position = { line: 2, character: 3 };

      testMongoDBService._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        'test',
        [{ name: 'collection' }]
      );
      const result = await testMongoDBService.provideCompletionItems(
        textFromEditor,
        position
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const firstEvalResult = await testMongoDBService.evaluate(
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

      const secondEvalResult = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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
      const result = await testMongoDBService.evaluate(
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

  suite('Export to language mode', function () {
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

  suite('Diagnostic', function () {
    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(() => {
      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'test' }]);
    });

    test('does not find use diagnostic issue when a line does not start with use', () => {
      const textFromEditor =
        "You can use '.hasNext()/.next()' to iterate through the cursor page by page";
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([]);
    });

    test('does not find use diagnostic issue when use in the middle of other command', () => {
      const textFromEditor = 'user.authenticate()';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([]);
    });

    test('does not find use diagnostic issue when use is followed by a space and curly bracket', () => {
      const textFromEditor = 'use (';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([]);
    });

    test('does not find use diagnostic issue when use is followed by a space and point', () => {
      const textFromEditor = 'use .';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([]);
    });

    test('does not find use diagnostic issue when use is followed by a space and bracket', () => {
      const textFromEditor = 'use [';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([]);
    });

    test('finds use without database diagnostic issue', () => {
      const textFromEditor = 'use ';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 3 },
          },
          message: "Did you mean `use('database')`?",
          data: { fix: "use('database')" },
        },
      ]);
    });

    test('finds use with an existing database without quotes diagnostic issue', () => {
      const textFromEditor = 'use test';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 8 },
          },
          message: "Did you mean `use('test')`?",
          data: { fix: "use('test')" },
        },
      ]);
    });

    test('finds use with a new database without quotes diagnostic issue', () => {
      const textFromEditor = 'use lena';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 8 },
          },
          message: "Did you mean `use('lena')`?",
          data: { fix: "use('lena')" },
        },
      ]);
    });

    test('finds use with database and single quotes diagnostic issue', () => {
      const textFromEditor = "use 'test'";
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
          message: "Did you mean `use('test')`?",
          data: { fix: "use('test')" },
        },
      ]);
    });

    test('finds use with database and double quotes diagnostic issue', () => {
      const textFromEditor = 'use "test"';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
          message: "Did you mean `use('test')`?",
          data: { fix: "use('test')" },
        },
      ]);
    });

    test('finds show databases diagnostic issue', () => {
      const textFromEditor = 'show databases';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 14 },
          },
          message: 'Did you mean `db.getMongo().getDBs()`?',
          data: { fix: 'db.getMongo().getDBs()' },
        },
      ]);
    });

    test('finds show dbs diagnostic issue', () => {
      const textFromEditor = 'show dbs';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 8 },
          },
          message: 'Did you mean `db.getMongo().getDBs()`?',
          data: { fix: 'db.getMongo().getDBs()' },
        },
      ]);
    });

    test('finds show collections diagnostic issue', () => {
      const textFromEditor = 'show collections';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 16 },
          },
          message: 'Did you mean `db.getCollectionNames()`?',
          data: { fix: 'db.getCollectionNames()' },
        },
      ]);
    });

    test('finds show tables diagnostic issue', () => {
      const textFromEditor = 'show tables';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 11 },
          },
          message: 'Did you mean `db.getCollectionNames()`?',
          data: { fix: 'db.getCollectionNames()' },
        },
      ]);
    });

    test('finds show profile diagnostic issue', () => {
      const textFromEditor = 'show profile';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 12 },
          },
          message: "Did you mean `db.getCollection('system.profile').find()`?",
          data: { fix: "db.getCollection('system.profile').find()" },
        },
      ]);
    });

    test('finds show users diagnostic issue', () => {
      const textFromEditor = 'show users';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
          message: 'Did you mean `db.getUsers()`?',
          data: { fix: 'db.getUsers()' },
        },
      ]);
    });

    test('finds show roles diagnostic issue', () => {
      const textFromEditor = 'show roles';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
          message: 'Did you mean `db.getRoles({ showBuiltinRoles: true })`?',
          data: { fix: 'db.getRoles({ showBuiltinRoles: true })' },
        },
      ]);
    });

    test('finds show logs diagnostic issue', () => {
      const textFromEditor = 'show logs';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 9 },
          },
          message: "Did you mean `db.adminCommand({ getLog: '*' })`?",
          data: { fix: "db.adminCommand({ getLog: '*' })" },
        },
      ]);
    });

    test('finds show log diagnostic issue', () => {
      const textFromEditor = 'show log';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 8 },
          },
          message: "Did you mean `db.adminCommand({ getLog: 'global' })`?",
          data: { fix: "db.adminCommand({ getLog: 'global' })" },
        },
      ]);
    });

    test('finds show log without type diagnostic issue', () => {
      const textFromEditor = 'show log ';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 8 },
          },
          message: "Did you mean `db.adminCommand({ getLog: 'global' })`?",
          data: { fix: "db.adminCommand({ getLog: 'global' })" },
        },
      ]);
    });

    test('finds show log with type and single quotes diagnostic issue', () => {
      const textFromEditor = "show log 'global'";
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 17 },
          },
          message: "Did you mean `db.adminCommand({ getLog: 'global' })`?",
          data: { fix: "db.adminCommand({ getLog: 'global' })" },
        },
      ]);
    });

    test('finds show log with type and double quotes diagnostic issue', () => {
      const textFromEditor = 'show log "startupWarnings"';
      const diagnostics = testMongoDBService.provideDiagnostics(textFromEditor);

      expect(diagnostics).to.be.deep.equal([
        {
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 26 },
          },
          message:
            "Did you mean `db.adminCommand({ getLog: 'startupWarnings' })`?",
          data: { fix: "db.adminCommand({ getLog: 'startupWarnings' })" },
        },
      ]);
    });
  });
});
