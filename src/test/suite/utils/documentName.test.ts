import * as vscode from 'vscode';
import { ObjectId } from 'bson';
import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';

import { getFileDisplayNameForDocument } from '../../../utils/documentName';

suite('#getFileDisplayNameForDocumentId', function () {
  let originalDefaultDocumentDisplayName;
  beforeEach(async function () {
    originalDefaultDocumentDisplayName = vscode.workspace
      .getConfiguration('mdb')
      .get('defaultDocumentDisplayName');
  });
  afterEach(async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('defaultDocumentDisplayName', originalDefaultDocumentDisplayName);
  });

  test('falls back to _id if no configured fields exist', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('defaultDocumentDisplayName', ['name', 'title']);

    const result = getFileDisplayNameForDocument(
      { _id: 'id123', pineapple: 'yes' },
      'db.col',
    );
    expect(result).to.equal('db.col: id123');
  });

  test('it uses the _id field as the document name when defaultDocumentDisplayName is undefined', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('defaultDocumentDisplayName', undefined);

    const str = 'abc//\\\nab  c$%%..@1s   df"';
    const result = await getFileDisplayNameForDocument({ _id: str }, 'a.b');
    const expected = 'a.b: abc%2f%2f%5c%5c%5cnab  c$%25%25..@1s   df"';
    expect(result).to.equal(expected);
  });

  test('skips invalid fields', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('defaultDocumentDisplayName', ['name', 'title', 'turtle', '_id']);

    const result = getFileDisplayNameForDocument(
      { _id: 'aaa', title: null, turtle: 'pineapple' },
      'db.col',
    );
    expect(result).to.equal('db.col: pineapple');
  });

  test('handles ObjectId as _id', async function () {
    const objectId = new ObjectId('5d973ae744376d2aae72a161');
    const result = getFileDisplayNameForDocument({ _id: objectId }, 'db.col');
    expect(result).to.equal("db.col: ObjectId('5d973ae744376d2aae72a161')");
  });

  test('handles numeric field value', async function () {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('defaultDocumentDisplayName', ['count', '_id']);

    const result = getFileDisplayNameForDocument(
      { _id: 'aaa', count: 42 },
      'db.col',
    );
    expect(result).to.equal('db.col: 42');
  });

  test('it strips special characters from the document id', function () {
    const doc = {
      _id: 'abc//\\\nab  c"$%%..@1s   df""',
    };
    const result = getFileDisplayNameForDocument(doc, 'a.b');
    const expected = 'a.b: abc%2f%2f%5c%5c%5cnab  c"$%25%25..@1s   df""';
    expect(result).to.equal(expected);
  });

  test('trims long namespaces to 100 characters', async function () {
    const longDb = 'a'.repeat(60);
    const longCol = 'b'.repeat(60);
    const namespace = `${longDb}.${longCol}`;

    const result = getFileDisplayNameForDocument({ _id: 'test' }, namespace);

    expect(result).to.equal(`${'a'.repeat(50)}.${'b'.repeat(50)}: test`);
  });

  test('it trims the string to 200 characters', function () {
    const doc = {
      _id: '123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdf123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdffbnjiekbfdakjsdbfkjsabdfkjasbfbnjiekbfdakjsdbfkjsabdfkjasbkjasbfbnjiekbfdakjsdbfkjsabdfkjasb',
    };
    const result = getFileDisplayNameForDocument(doc, 'db.col');
    const expected =
      'db.col: 123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdf123sdfhadfbnjiekbfdakjsdbfkjsabdfkjasbdfkjsvasdjvbskdafdffbnjiekbfdakjsdbfkjsabdfkjasbfbnjiekbfdakjsdbfkjsabdfkjasbkjasbfbnjiekbfdakjsd';
    expect(result).to.equal(expected);
  });

  test('it handles ids that are objects', function () {
    const doc = {
      _id: {
        str: 'abc//\\\nab  c$%%..@1s   df"',
        b: new ObjectId('5d973ae744376d2aae72a160'),
      },
    };
    const result = getFileDisplayNameForDocument(doc, 'db.col');
    const expected =
      "db.col: {str:'abc%2f%2f%5c%5c%5cnab  c$%25%25..@1s   df\"',b:ObjectId('5d973ae744376d2aae72a160')}";
    expect(result).to.equal(expected);
  });

  test('has the namespace at the start of the display name', function () {
    const doc = {
      _id: '1',
      title: 'pineapples',
    };
    const result = getFileDisplayNameForDocument(doc, 'grilled');
    const expected = 'grilled: pineapples';
    expect(result).to.equal(expected);
  });
});
