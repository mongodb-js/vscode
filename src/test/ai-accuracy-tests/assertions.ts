import assert from 'assert';

import type { Fixtures } from './fixtures/fixture-loader';

export const isDeepStrictEqualTo = (expected: unknown) => (actual: unknown) =>
  assert.deepStrictEqual(actual, expected);

export const isDeepStrictEqualToFixtures =
  (
    db: string,
    coll: string,
    fixtures: Fixtures,
    comparator: (document: Document) => boolean
  ) =>
  (actual: unknown) => {
    const expected = fixtures[db][coll].filter(comparator);
    assert.deepStrictEqual(actual, expected);
  };

export const anyOf =
  (assertions: ((result: unknown) => void)[]) => (actual: unknown) => {
    const errors: Error[] = [];
    for (const assertion of assertions) {
      try {
        assertion(actual);
      } catch (e) {
        errors.push(e as Error);
      }
    }

    if (errors.length === assertions.length) {
      throw errors[errors.length - 1];
    }
  };
