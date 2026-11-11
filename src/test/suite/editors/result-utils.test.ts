import { expect } from 'chai';

import { isSafeQueryResult } from '../../../editors/result-utils';
import type { PlaygroundRunResult } from '../../../types/playgroundType';

function makeResult(
  overrides: Partial<PlaygroundRunResult> = {},
): PlaygroundRunResult {
  return {
    content: [],
    ...overrides,
  };
}

suite('result-utils', function () {
  suite('isSafeQueryResult', function () {
    test('returns false when constructionOptions are missing', function () {
      const result = makeResult();

      expect(isSafeQueryResult(result)).to.equal(false);
    });

    test('returns false when chain includes map method', function () {
      const result = makeResult({
        constructionOptions: {
          chains: [{ method: 'map' }],
          options: { method: 'find' },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(false);
    });

    test('returns false for aggregate with $out stage', function () {
      const result = makeResult({
        constructionOptions: {
          options: {
            method: 'aggregate',
            args: ['db', 'coll', [{ $out: 'archived' }]],
          },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(false);
    });

    test('returns false for aggregate with $merge stage', function () {
      const result = makeResult({
        constructionOptions: {
          options: {
            method: 'aggregate',
            args: ['db', 'coll', [{ $merge: { into: 'archived' } }]],
          },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(false);
    });

    test('returns true for aggregate without forbidden stages', function () {
      const result = makeResult({
        type: 'AggregationCursor',
        constructionOptions: {
          options: {
            method: 'aggregate',
            args: ['db', 'coll', [{ $match: { status: 'open' } }]],
          },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(true);
    });

    test('returns true for non-aggregate queries without map chain', function () {
      const result = makeResult({
        type: 'Cursor',
        constructionOptions: {
          chains: [{ method: 'limit' }],
          options: { method: 'find' },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(true);
    });

    test('returns false when the result type is not a cursor', function () {
      const result = makeResult({
        type: 'object',
        constructionOptions: {
          options: { method: 'find', args: ['db', 'coll', {}, {}, {}] },
          chains: [{ method: 'limit', args: [10] }],
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(false);
    });

    test('returns false when the result type is missing', function () {
      const result = makeResult({
        constructionOptions: {
          options: { method: 'find', args: ['db', 'coll', {}, {}, {}] },
        } as any,
      });

      expect(isSafeQueryResult(result)).to.equal(false);
    });
  });
});
