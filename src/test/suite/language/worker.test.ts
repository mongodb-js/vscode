import chai from 'chai';
import sinon from 'sinon';

import {
  getLanguage,
  handleMessageFromParentPort,
} from '../../../language/worker';
import { serializeBSON, deserializeBSON } from '../../../language/serializer';
import { ServerCommand } from '../../../language/serverCommands';

const expect = chai.expect;

suite('Worker Test Suite', function () {
  suite('getLanguage', function () {
    test('returns shell for object content in shell format', function () {
      const language = getLanguage({ hello: 'world' }, 'shell');

      expect(language).to.equal('shell');
    });

    test('returns json for object content in ejson format', function () {
      const language = getLanguage({ hello: 'world' }, 'ejson');

      expect(language).to.equal('json');
    });

    test('returns plaintext for primitive content', function () {
      const language = getLanguage(42, 'shell');

      expect(language).to.equal('plaintext');
    });
  });

  suite('handleMessageFromParentPort', function () {
    test('posts sanitized result for unsafe query results', async function () {
      const executeResult = {
        data: {
          result: {
            content: [{ _id: '1' }],
            language: 'json',
            type: 'Cursor',
            constructionOptions: {
              chains: [{ method: 'map' }],
              options: { method: 'find' },
            },
          },
        },
      };
      const executeFn = sinon.stub().resolves(executeResult);
      const postMessageFn = sinon.stub();
      const payload = {
        codeToEvaluate: 'db.test.find()',
        connectionString: 'mongodb://localhost:27017',
        connectionOptions: {},
        expectedFormat: 'ejson',
      };

      await handleMessageFromParentPort(
        {
          name: ServerCommand.executeCodeFromPlayground,
          data: serializeBSON(payload),
        },
        { executeFn, postMessageFn },
      );

      expect(executeFn.calledOnceWithExactly(payload)).to.equal(true);
      expect(postMessageFn.calledOnce).to.equal(true);

      const message = postMessageFn.firstCall.args[0] as {
        name: string;
        payload: string;
      };
      expect(message.name).to.equal(ServerCommand.codeExecutionResult);

      const deserializedPayload = deserializeBSON(message.payload);
      expect(deserializedPayload.data.result.constructionOptions).to.equal(
        undefined,
      );
      expect(deserializedPayload.data.result.content).to.deep.equal([
        { _id: '1' },
      ]);
    });

    test('posts result unchanged for safe query results', async function () {
      const executeResult = {
        data: {
          result: {
            content: [{ _id: '2' }],
            language: 'json',
            type: 'Cursor',
            constructionOptions: {
              options: { method: 'find' },
            },
          },
        },
      };
      const executeFn = sinon.stub().resolves(executeResult);
      const postMessageFn = sinon.stub();

      await handleMessageFromParentPort(
        {
          name: ServerCommand.executeCodeFromPlayground,
          data: serializeBSON({
            codeToEvaluate: 'db.test.find()',
            connectionString: 'mongodb://localhost:27017',
            connectionOptions: {},
            expectedFormat: 'ejson',
          }),
        },
        { executeFn, postMessageFn },
      );

      expect(postMessageFn.calledOnce).to.equal(true);

      const message = postMessageFn.firstCall.args[0] as {
        name: string;
        payload: string;
      };
      const deserializedPayload = deserializeBSON(message.payload);

      expect(
        deserializedPayload.data.result.constructionOptions.options.method,
      ).to.equal('find');
    });

    test('ignores unsupported message names', async function () {
      const executeFn = sinon.stub().resolves({ data: null });
      const postMessageFn = sinon.stub();

      await handleMessageFromParentPort(
        {
          name: ServerCommand.showInfoMessage,
          data: serializeBSON({ random: 'value' }),
        },
        { executeFn, postMessageFn },
      );

      expect(executeFn.called).to.equal(false);
      expect(postMessageFn.called).to.equal(false);
    });
  });
});
