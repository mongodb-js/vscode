import assert from 'assert';
import util from 'util';
import type { Document } from 'mongodb';

import type { Fixtures } from './fixtures/fixture-loader';
import { getRunnableContentFromString } from '../../participant/participant';
import { execute } from '../../language/worker';
import type { ShellEvaluateResult } from '../../types/playgroundType';

export const runCodeInMessage = async (
  message: string,
  connectionString: string
): Promise<{
  printOutput: string[];
  data: ShellEvaluateResult;
  error: any;
}> => {
  const codeToEvaluate = getRunnableContentFromString(message);

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
    const expected = fixtures[db][coll].documents.filter(comparator);
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
