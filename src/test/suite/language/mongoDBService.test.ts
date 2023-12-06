import type * as vscode from 'vscode';
import { before, after, beforeEach, afterEach } from 'mocha';
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
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';

import MongoDBService, {
  languageServerWorkerFileName,
} from '../../../language/mongoDBService';
import { mdbTestExtension } from '../stubbableMdbExtension';
import { StreamStub } from '../stubs';
import READ_PREFERENCES from '../../../views/webview-app/legacy/connection-model/constants/read-preferences';
import DIAGNOSTIC_CODES from '../../../language/diagnosticCodes';
import LINKS from '../../../utils/links';
import Sinon from 'sinon';

const expect = chai.expect;
const INCREASED_TEST_TIMEOUT = 5000;

suite('MongoDBService Test Suite', () => {
  const params = {
    connectionId: 'pineapple',
    connectionString: 'mongodb://localhost:27088',
    connectionOptions: {
      readPreference: READ_PREFERENCES.PRIMARY,
      productDocsLink: LINKS.extensionDocs(),
      productName: 'MongoDB for VS Code',
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
      await testMongoDBService.activeConnectionChanged(params);
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
      await testMongoDBService.activeConnectionChanged(params);

      expect(testMongoDBService.connectionString).to.be.equal(
        'mongodb://localhost:27088'
      );

      await testMongoDBService.activeConnectionChanged({ connectionId: null });

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

      await testMongoDBService.activeConnectionChanged(params);
    });

    test('provide shell collection methods completion if global scope', async () => {
      const content = 'db.test.';
      const position = { line: 0, character: 8 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion if function scope', async () => {
      const content = 'const name = () => { db.test. }';
      const position = { line: 0, character: 29 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion for a collection name in a bracket notation', async () => {
      const content = ['use("test");', 'db["test"].'].join('\n');
      const position = { line: 1, character: 11 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion for a collection name in getCollection', async () => {
      const content = ['use("test");', 'db.getCollection("test").'].join('\n');
      const position = { line: 1, character: 41 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell collection methods completion if single quotes', async () => {
      const content = ["use('test');", "db['test']."].join('\n');
      const position = { line: 1, character: 11 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'find'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell db methods completion with dot the same line', async () => {
      const content = 'db.';
      const position = { line: 0, character: 3 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
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
      const content = ['db', '.'].join('\n');
      const position = { line: 1, character: 1 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'getCollectionNames'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell db methods completion with dot after space', async () => {
      const content = 'db .';
      const position = { line: 0, character: 4 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
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
      const content = 'db.collection.aggregate().';
      const position = { line: 0, character: 26 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.find().';
      const position = { line: 0, character: 21 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell find cursor methods completion with args at the same line', async () => {
      const content = [
        'use("companies");',
        '',
        'db.companies.find({ blog_feed_url}).',
      ].join('\n');
      const position = { line: 2, character: 36 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide shell find cursor methods completion with args next line', async () => {
      const content = [
        'use("companies");',
        '',
        'const name = () => { db.companies.find({',
        '  blog_feed_url',
        '}).}',
      ].join('\n');
      const position = { line: 4, character: 3 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'allowPartialResults'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Method);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide fields completion in find in dot notation when has db', async () => {
      const content = 'use("test"); db.collection.find({ j});';
      const position = { line: 0, character: 35 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find in bracket notation when has db', async () => {
      const content = 'use("test"); db["collection"].find({ j});';
      const position = { line: 0, character: 38 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if text not formatted', async () => {
      const content = 'use("test");db.collection.find({j});';
      const position = { line: 0, character: 33 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if functions are multi-lined', async () => {
      const content = [
        'use("test");',
        'const name = () => {',
        '  db.collection.find({ j});',
        '}',
      ].join('\n');
      const position = { line: 2, character: 24 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if object is multi-lined', async () => {
      const content = [
        'use("test");',
        '',
        'db.collection.find({',
        '  j',
        '});',
      ].join('\n');
      const position = { line: 3, character: 3 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find if a key is surrounded by spaces', async () => {
      const content = 'use("test"); db.collection.find({ j });';
      const position = { line: 0, character: 35 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find for a proper db', async () => {
      const content = 'use("first"); use("second"); db.collection.find({ t});';
      const position = { line: 0, character: 51 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);
      testMongoDBService.cacheFields('second.collection', ['TypeScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content =
        'use("test"); const name = () => { db.collection.find({ j}); }';
      const position = { line: 0, character: 56 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide fields completion in find for a proper collection', async () => {
      const content = 'use("test"); db.firstCollection.find({ j});';
      const position = { line: 0, character: 40 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.firstCollection', [
        'JavaScript First',
      ]);
      testMongoDBService.cacheFields('test.secondCollection', [
        'JavaScript Second',
      ]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript First'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('do not provide fields completion in find if db not found', async () => {
      const content = 'db.collection.find({ j});';
      const position = { line: 0, character: 22 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.be.undefined;
    });

    test('do not provide fields completion in find outside object property', async () => {
      const content = 'use("test"); db.collection.find(j);';
      const position = { line: 0, character: 28 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.be.undefined;
    });

    test('provide fields completion in aggregate inside the $match stage', async () => {
      const content =
        'use("test"); db.collection.aggregate([ { $match: { j} } ])';
      const position = { line: 0, character: 52 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide stages completion in aggregate when has db', async () => {
      const content = 'use("test"); db.collection.aggregate([{ $m}]);';
      const position = { line: 0, character: 42 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $m}]);';
      const position = { line: 0, character: 29 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$match'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide stages completion in find if object is multi-lined', async () => {
      const content = [
        'use("test");',
        '',
        'db.aggregate.find([{',
        '  $c',
        '}]);',
      ].join('\n');
      const position = { line: 3, character: 4 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$count'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Keyword);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide query completion for the $match stage', async () => {
      const content = 'db.collection.aggregate([{ $match: { $e} }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$expr'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Keyword);
      expect(completion).to.have.property('documentation');
    });

    test('provide query completion in find', async () => {
      const content = 'db.collection.find({ $e});';
      const position = { line: 0, character: 23 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $merge: { $e} }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$expr'
      );

      expect(completion).to.be.undefined;
    });

    test('provide bson completion in find', async () => {
      const content = 'db.collection.find({ _id: O});';
      const position = { line: 0, character: 27 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $match: { _id: O }}]);';
      const position = { line: 0, character: 42 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.find({ _id: "$$N" });';
      const position = { line: 0, character: 30 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$$NOW'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Variable);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide system variable completion in aggregate', async () => {
      const content = 'db.collection.aggregate([{ $match: { _id: "$$R" }}]);';
      const position = { line: 0, character: 46 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$$ROOT'
      );

      expect(completion?.kind).to.be.eql(CompletionItemKind.Variable);

      const documentation = completion?.documentation;
      expect(MarkupContent.is(documentation)).to.be.eql(true);
      expect((documentation as MarkupContent).value).to.include('[Read More]');
    });

    test('provide field reference completion in find when has db', async () => {
      const content =
        "use('test'); db.collection.find({ $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } });";
      const position = { line: 0, character: 77 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );

      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('do not provide field reference completion in find if db not found', async () => {
      const content =
        "db.collection.find({ $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } });";
      const position = { line: 0, character: 64 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );
      expect(completion).to.be.undefined;
    });

    test('provide field reference completion in aggregate when has db', async () => {
      const content =
        "use('test'); db.collection.aggregate({ $match: { $expr: { $gt: [{ $getField: { $literal: '$p' } }, 200] } } });";
      const position = { line: 0, character: 92 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );
      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('provide field reference completion in aggregate when collection is specified via getCollection', async () => {
      const content =
        "use('test'); db.getCollection('collection').aggregate([{ $match: '$p' }]);";
      const position = { line: 0, character: 68 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['price']);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$price'
      );
      expect(completion).to.have.property('kind', CompletionItemKind.Reference);
    });

    test('clear cached databases', async () => {
      const content = 'use("m");';
      const position = { line: 0, character: 6 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'mydata' }]);

      let result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.have.property('label', 'mydata');
      expect(result[0]).to.have.property('kind', CompletionItemKind.Field);

      testMongoDBService.clearCachedCompletions({ databases: true });

      result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(0);
    });

    test('clear cached collections', async () => {
      const content = 'use("test"); db.';
      const position = { line: 0, character: 16 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheCollections('test', [{ name: 'coll' }]);

      let result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      let completion = result.find(
        (item: CompletionItem) => item.label === 'coll'
      );
      expect(completion).to.have.property('kind', CompletionItemKind.Folder);

      testMongoDBService.clearCachedCompletions({ collections: true });
      result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      completion = result.find((item: CompletionItem) => item.label === 'coll');
      expect(completion).to.be.undefined;
    });

    test('clear cached fields', async () => {
      const content = 'use("test"); db.collection.find({ j});';
      const position = { line: 0, character: 35 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService.cacheFields('test.collection', ['JavaScript']);

      let result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      let completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );
      expect(completion).to.have.property('kind', CompletionItemKind.Field);

      testMongoDBService.clearCachedCompletions({ fields: true });
      result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      completion = result.find(
        (item: CompletionItem) => item.label === 'JavaScript'
      );
      expect(completion).to.be.undefined;
    });

    test('provide aggregation expression completion for other than $match stages', async () => {
      const content =
        'db.collection.aggregate([{ $project: { yearMonthDayUTC: { $d } } }]);';
      const position = { line: 0, character: 59 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate({ $match: { $d } });';
      const position = { line: 0, character: 38 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$dateToString'
      );
      expect(completion).to.be.undefined;
    });

    test('provide aggregation conversion completion for other than $match stages', async () => {
      const content =
        'db.collection.aggregate([{ $project: { result: {$c} } }]);';
      const position = { line: 0, character: 50 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $match: { $c } }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$convert'
      );
      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator completion for the $project stage', async () => {
      const content =
        'db.collection.aggregate([{ $project: { revenue: { $a} } }]);';
      const position = { line: 0, character: 52 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content =
        'db.collection.aggregate([{ $group: { _id: "$author", avgCopies: { $a} } }]);';
      const position = { line: 0, character: 68 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $match: { $a } }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );
      expect(completion).to.be.undefined;
    });

    test('do not provide aggregation accumulator completion for the $documents stage', async () => {
      const content = 'db.collection.aggregate([{ $documents: { $a } }]);';
      const position = { line: 0, character: 43 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$addToSet'
      );
      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator direction completion for the $project stage', async () => {
      const content =
        'db.collection.aggregate([{ $project: { revenue: { $b} } }]);';
      const position = { line: 0, character: 52 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content =
        'db.collection.aggregate([{ $group: { _id: "$author", avgCopies: { $b} } }]);';
      const position = { line: 0, character: 68 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $match: { $b } }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );
      expect(completion).to.be.undefined;
    });

    test('do not provide aggregation accumulator direction completion for the $documents stage', async () => {
      const content = 'db.collection.aggregate([{ $documents: { $b } }]);';
      const position = { line: 0, character: 43 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$bottom'
      );
      expect(completion).to.be.undefined;
    });

    test('provide aggregation accumulator window completion for the $setWindowFields stage', async () => {
      const content =
        'db.collection.aggregate([{ $setWindowFields: { partitionBy: "$state", output: { documentNumberForState: { $d} } } }]);';
      const position = { line: 0, character: 108 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
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
      const content = 'db.collection.aggregate([{ $group: { $d } }]);';
      const position = { line: 0, character: 39 };
      const document = TextDocument.create('init', 'javascript', 1, content);
      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      const completion = result.find(
        (item: CompletionItem) => item.label === '$documentNumber'
      );
      expect(completion).to.be.undefined;
    });

    test('provide db and use identifier completion', async () => {
      const content = '';
      const position = { line: 0, character: 0 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
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
      expect(useCompletion).to.have.property('detail', 'use(<databaseName>)');
    });

    test('provide db names completion for literal', async () => {
      const content = 'use("a");';
      const position = { line: 0, character: 6 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.have.property('label', 'admin');
      expect(result[0]).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template start line', async () => {
      const content = ['use(`', '', '`);'].join('\n');
      const position = { line: 0, character: 5 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.have.property('label', 'admin');
      expect(result[0]).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template middle line', async () => {
      const content = ['use(`', '', '`);'].join('\n');
      const position = { line: 1, character: 0 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.have.property('label', 'admin');
      expect(result[0]).to.have.property('kind', CompletionItemKind.Field);
    });

    test('provide db names completion for template end line', async () => {
      const content = ['use(`', '', '`);'].join('\n');
      const position = { line: 2, character: 0 };
      const document = TextDocument.create('init', 'javascript', 1, content);

      testMongoDBService._cacheDatabaseCompletionItems([{ name: 'admin' }]);

      const result = await testMongoDBService.provideCompletionItems({
        document,
        position,
      });
      expect(result.length).to.be.equal(1);
      expect(result[0]).to.have.property('label', 'admin');
      expect(result[0]).to.have.property('kind', CompletionItemKind.Field);
    });

    [
      {
        suiteDescription:
          'when connected to a default db and not explicitly using a db',
        dbInUse: 'defaultDB',
        defaultContent: '',
        beforeAssertions: () => {
          Sinon.stub(testMongoDBService, 'connectionString').get(
            () => `${params.connectionString}/defaultDB`
          );
        },
      },
      {
        suiteDescription:
          'when connected to a default db and also explicitly using another db',
        dbInUse: 'anotherTestDB',
        defaultContent: "use('anotherTestDB');",
        beforeAssertions: () => {
          Sinon.stub(testMongoDBService, 'connectionString').get(
            () => `${params.connectionString}/defaultDB`
          );
        },
      },
      {
        suiteDescription:
          'when not connected to a default db and explicitly using another db',
        dbInUse: 'anotherTestDB',
        defaultContent: "use('anotherTestDB');",
        beforeAssertions: () => {
          () => params.connectionString;
        },
      },
    ].forEach(
      ({ suiteDescription, beforeAssertions, defaultContent, dbInUse }) => {
        suite(suiteDescription, () => {
          beforeEach(beforeAssertions);
          afterEach(() => {
            Sinon.restore();
            testMongoDBService.clearCachedCompletions({
              databases: true,
              collections: true,
              fields: true,
            });
          });

          test('provide collection names completion for valid object names', async () => {
            const content = defaultContent ? `${defaultContent} db.` : 'db.';
            const position = { line: 0, character: content.length };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [{ name: 'empty' }]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'empty'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion for object names with dashes', async () => {
            const content = defaultContent ? `${defaultContent} db.` : 'db.';
            const position = { line: 0, character: content.length };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'coll-name'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
            expect(findCollectionCompletion)
              .to.have.property('textEdit')
              .that.has.property(
                'newText',
                defaultContent
                  ? defaultContent + " db['coll-name']"
                  : "db['coll-name']"
              );
          });

          test('provide collection names completion for object names with dots', async () => {
            const content = defaultContent
              ? [defaultContent, '', 'db.']
              : ['db.'];
            const position = {
              line: content.length - 1,
              character: content[content.length - 1].length,
            };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'animals.humans' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'animals.humans'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
            expect(findCollectionCompletion)
              .to.have.property('textEdit')
              .that.has.property('newText', "db['animals.humans']");
          });

          test('provide collection names completion in variable declarations', async () => {
            const content = defaultContent
              ? [defaultContent, '', 'let a = db.']
              : ['let a = db.'];
            const position = {
              line: content.length - 1,
              character: content[content.length - 1].length,
            };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'cocktailbars' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
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
            const content = defaultContent
              ? defaultContent + " db['']"
              : "db['']";
            const completionCharacterIdx = content.indexOf("['") + 2; // index starts at 0 and we are finding index of 2 characters.
            const position = { line: 0, character: completionCharacterIdx };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'coll-name'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion for getCollection as a simple string', async () => {
            const content = defaultContent
              ? defaultContent + " db.getCollection('')"
              : "db.getCollection('')";
            const completionCharacterIdx = content.lastIndexOf("('") + 2; // index starts at 0 and we are finding index of 2 characters.
            const position = { line: 0, character: completionCharacterIdx };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'coll-name'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion for getCollection as a string template', async () => {
            const content = defaultContent
              ? defaultContent + ' db.getCollection(``)'
              : 'db.getCollection(``)';
            const completionCharacterIdx = content.lastIndexOf('(`') + 2; // index starts at 0 and we are finding index of 2 characters.
            const position = { line: 0, character: completionCharacterIdx };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'coll-name'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names and shell db symbol completion for db symbol with dot notation', async () => {
            const content = defaultContent ? defaultContent + ' db.' : 'db.';
            const position = { line: 0, character: content.length };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
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
            const content = [
              '',
              'let a = db.cocktailbars.find({}).toArray();',
              '',
              'db.',
            ];
            if (defaultContent) {
              content.unshift(defaultContent);
            }

            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'cocktailbars' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
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
            const content = [
              '',
              'let a = db.cocktailbars.aggregate({}).toArray();',
              '',
              'db.',
            ];
            if (defaultContent) {
              content.unshift(defaultContent);
            }

            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'cocktailbars' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
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
            const content = defaultContent
              ? defaultContent + ' db..find().close()'
              : 'db..find().close()';
            const completionCharacterIdx = content.indexOf('db.') + 3; // Index starts with 0 and we are finding index of 3 characters
            const position = { line: 0, character: completionCharacterIdx };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'cocktails' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
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
            const content = defaultContent
              ? defaultContent + ' db..find()'
              : 'db..find()';
            const completionCharacterIdx = content.indexOf('db.') + 3; // Index starts with 0 and we are finding index of 3 characters
            const position = { line: 0, character: completionCharacterIdx };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'coll-name' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'coll-name'
            );
            expect(findCollectionCompletion)
              .to.have.property('textEdit')
              .that.has.property(
                'newText',
                defaultContent
                  ? defaultContent + " db['coll-name'].find()"
                  : "db['coll-name'].find()"
              );
          });

          test('provide collection names completion after single line comment', async () => {
            const content = ['', '// Comment', 'db.'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion after single line comment with new line character', async () => {
            const content = ['', '// Comment\\n', 'db.'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion after multi-line comment', async () => {
            const content = ['', '/*', ' * Comment', '*/', 'db.'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion after end of line comment', async () => {
            const content = [
              defaultContent ? defaultContent + ' // Comment' : ' // Comment',
              '',
              'db.',
            ];
            const position = { line: 2, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion at the same line block comment starts', async () => {
            const content = ['', 'db. /*', '* Comment', '*/'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 3, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion at the same line block comment ends', async () => {
            const content = ['', '/*', '  * Comment', '*/ db.'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 6 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion at the same line with end line comment', async () => {
            const content = ['', 'db. // Comment'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });

          test('provide collection names completion if code without a semicolon', async () => {
            const content = ['', 'db.'];
            if (defaultContent) {
              content.unshift(defaultContent);
            }
            const position = { line: content.length - 1, character: 3 };
            const document = TextDocument.create(
              'init',
              'javascript',
              1,
              content.join('\n')
            );

            testMongoDBService._cacheCollections(dbInUse, [
              { name: 'collection' },
            ]);

            const result = await testMongoDBService.provideCompletionItems({
              document,
              position,
            });
            const findCollectionCompletion = result.find(
              (item: CompletionItem) => item.label === 'collection'
            );
            expect(findCollectionCompletion).to.have.property(
              'kind',
              CompletionItemKind.Folder
            );
          });
        });
      }
    );
  });

  suite('Evaluate', function () {
    this.timeout(INCREASED_TEST_TIMEOUT);

    const mongoClient = new MongoClient(params.connectionString, {
      readPreference: params.connectionOptions.readPreference,
    });
    const up = new StreamStub();
    const down = new StreamStub();
    const connection = createConnection(up, down);

    connection.listen();

    const testMongoDBService = new MongoDBService(connection);

    before(async () => {
      testMongoDBService._extensionPath =
        mdbTestExtension.extensionContextStub.extensionPath;
      await testMongoDBService.activeConnectionChanged(params);
      await mongoClient.connect();
    });

    after(async () => {
      await mongoClient.close(true);
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

    suite('DB commands evaluation', () => {
      const dbName1 = 'testDB1';
      const collectionName1 = 'testCollection1';
      let db1: Db;
      const dbName2 = 'testDB2';
      const collectionName2 = 'testCollection2';
      let db2: Db;
      beforeEach(async () => {
        db1 = mongoClient.db(dbName1);
        const TestCollection1 = await db1.createCollection(collectionName1);
        await TestCollection1.insertOne({ name: 'Test1', number: 1 });

        db2 = mongoClient.db(dbName2);
        const TestCollection2 = await db2.createCollection(collectionName2);
        await TestCollection2.insertOne({ name: 'Test2', number: 2 });
      });

      afterEach(async () => {
        await db1.dropDatabase();
        await db2.dropDatabase();
      });

      suite(
        'when connected to a default database and no explicit call to use specified',
        () => {
          test('it should evaluate the playground in the context of default database', async () => {
            await testMongoDBService.activeConnectionChanged({
              ...params,
              connectionString: `${params.connectionString}/${dbName1}`,
            });

            const source = new CancellationTokenSource();
            const result = await testMongoDBService.evaluate(
              {
                connectionId: 'pineapple',
                codeToEvaluate: `db.getCollection("${collectionName1}").findOne({}, { _id: 0, name: 1, number: 1 })`,
              },
              source.token
            );
            const expectedResult = {
              outputLines: [],
              result: {
                namespace: `${dbName1}.${collectionName1}`,
                type: 'Document',
                content: { name: 'Test1', number: 1 },
                language: 'json',
              },
            };

            expect(result).to.deep.equal(expectedResult);
          });
        }
      );

      suite(
        'when connected to a default database and an explicit call to use a database is specified',
        () => {
          test('it should evaluate the playground in the context of specified database', async () => {
            await testMongoDBService.activeConnectionChanged({
              ...params,
              connectionString: `${params.connectionString}/${dbName1}`,
            });

            const source = new CancellationTokenSource();
            const result = await testMongoDBService.evaluate(
              {
                connectionId: 'pineapple',
                codeToEvaluate: `use('${dbName2}'); db.getCollection("${collectionName2}").findOne({}, { _id: 0, name: 1, number: 1 })`,
              },
              source.token
            );
            const expectedResult = {
              outputLines: [],
              result: {
                namespace: `${dbName2}.${collectionName2}`,
                type: 'Document',
                content: { name: 'Test2', number: 2 },
                language: 'json',
              },
            };

            expect(result).to.deep.equal(expectedResult);
          });
        }
      );

      suite(
        'when not connected to any default database and an explicit call to use a database is specified',
        () => {
          test('it should evaluate the playground in the context of specified database', async () => {
            await testMongoDBService.activeConnectionChanged(params);

            const source = new CancellationTokenSource();
            const result = await testMongoDBService.evaluate(
              {
                connectionId: 'pineapple',
                codeToEvaluate: `use('${dbName2}'); db.getCollection("${collectionName2}").findOne({}, { _id: 0, name: 1, number: 1 })`,
              },
              source.token
            );
            const expectedResult = {
              outputLines: [],
              result: {
                namespace: `${dbName2}.${collectionName2}`,
                type: 'Document',
                content: { name: 'Test2', number: 2 },
                language: 'json',
              },
            };

            expect(result).to.deep.equal(expectedResult);
          });
        }
      );
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
