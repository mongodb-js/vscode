import { expect } from 'chai';

import { ServerCommand } from '../../../language/serverCommands';
import { handleMessageFromParentPort } from '../../../language/worker';
import type { ShellEvaluateResult } from '../../../types/playgroundType';

type Payload = {
  data: ShellEvaluateResult | null;
  error?: Error;
};

suite('Worker Test Suite', function () {
  suite('handleMessageFromParentPort', function () {
    test('does nothing for unrelated commands', async function () {
      let executeCalled = false;
      let postedMessage: { name: string; payload: Payload } | undefined;

      await handleMessageFromParentPort(
        {
          name: ServerCommand.activeConnectionChanged,
          data: {} as any,
        },
        {
          executeFn: () => {
            executeCalled = true;
            return Promise.resolve({ data: null });
          },
          postMessageFn: (message) => {
            postedMessage = message;
          },
        },
      );

      expect(executeCalled).to.equal(false);
      expect(postedMessage).to.equal(undefined);
    });

    test('posts original payload when query result is safe', async function () {
      const payload: Payload = {
        data: {
          result: {
            type: 'Cursor',
            content: [],
            language: 'json',
            constructionOptions: {
              options: { method: 'find', args: [] },
            } as any,
          },
        },
      };

      let postedMessage: { name: string; payload: Payload } | undefined;

      await handleMessageFromParentPort(
        {
          name: ServerCommand.executeCodeFromPlayground,
          data: {} as any,
        },
        {
          executeFn: () => Promise.resolve(payload),
          postMessageFn: (message) => {
            postedMessage = message;
          },
        },
      );

      expect(postedMessage?.name).to.equal(ServerCommand.codeExecutionResult);
      expect(postedMessage?.payload).to.equal(payload);
      expect(
        postedMessage?.payload.data?.result?.constructionOptions,
      ).to.not.equal(undefined);
    });

    test('strips constructionOptions when query result is unsafe', async function () {
      const payload: Payload = {
        data: {
          result: {
            type: 'Cursor',
            content: [],
            language: 'json',
            constructionOptions: {
              options: { method: 'find', args: [] },
              chains: [{ method: 'map', args: [] }],
            } as any,
          },
        },
      };

      let postedMessage: { name: string; payload: Payload } | undefined;

      await handleMessageFromParentPort(
        {
          name: ServerCommand.executeCodeFromPlayground,
          data: {} as any,
        },
        {
          executeFn: () => Promise.resolve(payload),
          postMessageFn: (message) => {
            postedMessage = message;
          },
        },
      );

      expect(postedMessage?.name).to.equal(ServerCommand.codeExecutionResult);
      expect(postedMessage?.payload).to.not.equal(payload);
      expect(postedMessage?.payload.data?.result?.constructionOptions).to.equal(
        undefined,
      );
      expect(payload.data?.result?.constructionOptions).to.not.equal(undefined);
    });
  });
});
