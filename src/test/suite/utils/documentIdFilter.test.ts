import { expect } from 'chai';
import {
  Binary,
  Decimal128,
  EJSON,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
} from 'bson';

import {
  documentIdFilter,
  formatDocumentIdForDisplay,
  unmatchedDocumentIdMessage,
} from '../../../utils/documentIdFilter';

suite('Document Id Filter Test Suite', function () {
  const objectId = new ObjectId('507f1f77bcf86cd799439011');

  const ids: [string, unknown][] = [
    ['ObjectId', objectId],
    ['string', 'a-string-id'],
    ['number', 42],
    ['zero', 0],
    ['empty string', ''],
    ['boolean', false],
    ['null', null],
    ['date', new Date('2026-01-01T00:00:00Z')],
    ['Long', Long.fromNumber(7)],
    ['Decimal128', Decimal128.fromString('1.5')],
    ['Binary', new Binary(Buffer.from('abc'))],
    ['MinKey', new MinKey()],
    ['MaxKey', new MaxKey()],
    ['compound object', { region: 'eu', shard: 3 }],
    ['array', [1, 'two', objectId]],
    // The webview serializes documents with EJSON, so these are the shapes it
    // sends back up.
    ['EJSON $oid', { $oid: '507f1f77bcf86cd799439011' }],
    ['EJSON $date', { $date: { $numberLong: '1700000000000' } }],
  ];

  for (const [label, documentId] of ids) {
    test(`wraps ${label} in $eq`, function () {
      expect(documentIdFilter(documentId)).to.deep.equal({
        _id: { $eq: documentId },
      });
    });
  }

  test('passes the value through untouched', function () {
    // Not a copy: an ObjectId degraded to a string would stop matching.
    expect(documentIdFilter(objectId)._id.$eq).to.equal(objectId);
  });

  suite('query operators as an _id', function () {
    // These reach the _id of an aggregation result because MongoDB 5.0+ allows
    // storing $-prefixed field names and $group lifts a stored value into it.
    // Unwrapped they are read as a wildcard filter; $eq is what stops that. The
    // server then refuses the operation - deleteOne 9248804, findOneAndReplace
    // 9248801 - and find compares literally, matching nothing.
    const payloads: [string, unknown][] = [
      ['$exists', { $exists: true }],
      ['$ne', { $ne: null }],
      ['$gte MinKey', { $gte: new MinKey() }],
      ['$in', { $in: [1, 2, 3] }],
      ['$not', { $not: { $type: 'minKey' } }],
      // Type-bracketed, so it matches no ObjectId or numeric _id and never
      // wildcarded in the first place, despite being the payload on the ticket.
      ['$gte empty string', { $gte: '' }],
    ];

    for (const [label, documentId] of payloads) {
      test(`never builds a bare filter for ${label}`, function () {
        const filter = documentIdFilter(documentId);
        expect(filter).to.deep.equal({ _id: { $eq: documentId } });
        // The operator must sit under $eq, never directly under _id.
        expect(Object.keys(filter._id)).to.deep.equal(['$eq']);
      });
    }
  });

  suite('formatDocumentIdForDisplay', function () {
    test('renders a BSON _id as Extended JSON, not [object Object]', function () {
      expect(formatDocumentIdForDisplay(objectId)).to.equal(
        '{"$oid":"507f1f77bcf86cd799439011"}',
      );
    });

    test('renders a string _id', function () {
      expect(formatDocumentIdForDisplay('active')).to.equal('"active"');
    });

    test('renders a compound _id', function () {
      expect(formatDocumentIdForDisplay({ region: 'eu', shard: 3 })).to.equal(
        '{"region":"eu","shard":{"$numberInt":"3"}}',
      );
    });

    test('is the same rendering the unmatched message uses', function () {
      expect(
        unmatchedDocumentIdMessage(objectId, 'app.events', true),
      ).to.include(formatDocumentIdForDisplay(objectId));
    });
  });

  suite('unmatchedDocumentIdMessage', function () {
    test('blames the query when the row came from one', function () {
      const message = unmatchedDocumentIdMessage('active', 'app.events', true);
      expect(message).to.include('No document in app.events has the _id');
      expect(message).to.include('"active"');
      expect(message).to.include('These are query results');
    });

    test('suggests a concurrent change when browsing the collection', function () {
      const message = unmatchedDocumentIdMessage('active', 'app.events', false);
      expect(message).to.include('deleted or changed');
      expect(message).to.not.include('These are query results');
    });

    test('hedges when the caller cannot tell', function () {
      const message = unmatchedDocumentIdMessage('active', 'app.events');
      expect(message).to.include('If this row came from a query');
    });

    test('serializes a BSON _id rather than printing [object Object]', function () {
      const message = unmatchedDocumentIdMessage(objectId, 'app.events', true);
      expect(message).to.include('507f1f77bcf86cd799439011');
    });
  });

  test('round-trips an EJSON-serialized ObjectId', function () {
    const serialized = EJSON.serialize({ _id: objectId }, { relaxed: false });
    expect(documentIdFilter(serialized._id)._id.$eq).to.deep.equal(
      serialized._id,
    );
  });
});
