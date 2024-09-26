import assert from 'assert';
import util from 'util';
import type { Document } from 'mongodb';

import type { Fixtures } from './fixtures/fixture-loader';
import { execute } from '../../language/worker';
import type { ShellEvaluateResult } from '../../types/playgroundType';
import { asyncIterableFromArray } from '../suite/participant/asyncIterableFromArray';
import { codeBlockIdentifier } from '../../participant/constants';
import { processStreamWithIdentifiers } from '../../participant/streamParsing';

export const runCodeInMessage = async (
  message: string,
  connectionString: string
): Promise<{
  printOutput: string[];
  data: ShellEvaluateResult;
  error: any;
}> => {
  // We only run the last code block passed.
  let codeToEvaluate = '';
  await processStreamWithIdentifiers({
    processStreamFragment: () => {
      /* no-op */
    },
    onStreamIdentifier: (codeBlockContent: string): void => {
      codeToEvaluate = codeBlockContent;
    },
    inputIterable: asyncIterableFromArray<string>([message]),
    identifier: codeBlockIdentifier,
  });

  if (codeToEvaluate.trim().length === 0) {
    throw new Error(`no code found in message: ${message}`);
  }

  const printOutput: string[] = [];

  const { data, error } = await execute({
    codeToEvaluate,
    connectionString,
    connectionOptions: {
      productName: 'VSCode Copilot AI accuracy tests',
      productDocsLink: 'N/A',
    },
    onPrint: (values) => {
      printOutput.push(
        ...values.map((v) =>
          typeof v.printable === 'string'
            ? v.printable
            : util.inspect(v.printable)
        )
      );
    },
  });

  if (error) {
    throw new Error(
      `An error occurred when attempting to run the code in the message: \n${message}\n___Error:\n${error}`
    );
  }

  return {
    printOutput,
    data,
    error,
  };
};

export const isDeepStrictEqualTo =
  (expected: unknown) =>
  (actual: unknown): void =>
    assert.deepStrictEqual(actual, expected);

export const isDeepStrictEqualToFixtures =
  (
    db: string,
    coll: string,
    fixtures: Fixtures,
    comparator: (document: Document) => boolean
  ) =>
  (actual: unknown): void => {
    const expected = fixtures[db][coll].documents.filter(comparator);
    assert.deepStrictEqual(actual, expected);
  };

export const anyOf =
  (assertions: ((result: unknown) => void)[]) =>
  (actual: unknown): void => {
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
