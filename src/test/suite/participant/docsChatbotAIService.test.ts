import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { DocsChatbotAIService } from '../../../participant/docsChatbotAIService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../../../package.json');

suite('DocsChatbotAIService Test Suite', function () {
  const initialFetch = global.fetch;
  let docsChatbotAIService: DocsChatbotAIService;

  beforeEach(() => {
    docsChatbotAIService = new DocsChatbotAIService();
  });

  afterEach(function () {
    global.fetch = initialFetch;
    sinon.restore();
  });

  test('creates conversations', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          _id: '650b4b260f975ef031016c8a',
          messages: [],
        }),
    });
    global.fetch = fetchStub;
    const conversation = await docsChatbotAIService.createConversation({
      signal: new AbortController().signal,
    });
    expect(conversation._id).to.be.eql('650b4b260f975ef031016c8a');
  });

  test('throws on server errors', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 500,
      ok: false,
      statusText: 'Server error',
      json: sinon.stub().rejects(new Error('invalid json')),
    });
    global.fetch = fetchStub;

    try {
      await docsChatbotAIService.createConversation({
        signal: new AbortController().signal,
      });
      expect.fail('It must fail with the server error');
    } catch (error) {
      expect((error as Error).message).to.include('Internal server error');
    }
  });

  test('throws when aborted', async () => {
    try {
      const abortController = new AbortController();
      abortController.abort();
      await docsChatbotAIService.createConversation({
        signal: abortController.signal,
      });
      expect.fail('It must fail with the server error');
    } catch (error) {
      expect((error as Error).message).to.include('This operation was aborted');
    }
  });

  test('throws on bad requests', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 400,
      ok: false,
      statusText: 'Client error',
      json: sinon.stub().resolves({}),
    });
    global.fetch = fetchStub;

    try {
      await docsChatbotAIService.createConversation({
        signal: new AbortController().signal,
      });
      expect.fail('It must fail with the bad request error');
    } catch (error) {
      expect((error as Error).message).to.include('Bad request');
    }
  });

  test('throws on a rate limit', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 429,
      ok: false,
      statusText: 'Model error',
      json: sinon.stub().resolves({}),
    });
    global.fetch = fetchStub;

    try {
      await docsChatbotAIService.createConversation({
        signal: new AbortController().signal,
      });
      expect.fail('It must fail with the rate limited error');
    } catch (error) {
      expect((error as Error).message).to.include('Rate limited');
    }
  });

  test('throws on timeout', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 504,
      ok: false,
      json: sinon.stub().resolves({}),
    });
    global.fetch = fetchStub;

    try {
      await docsChatbotAIService.addMessage({
        conversationId: '650b4b260f975ef031016c8a',
        message: 'what is mongosh?',
        signal: new AbortController().signal,
      });
      expect.fail('It must fail with the timeout error');
    } catch (error) {
      expect((error as Error).message).to.include('Timeout');
    }
  });

  test('rates docs chatbot response', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 204,
      ok: true,
      json: () => Promise.resolve(true),
    });
    global.fetch = fetchStub;
    const rating = await docsChatbotAIService.rateMessage({
      conversationId: '650b4b260f975ef031016c8a',
      messageId: '1',
      rating: true,
    });
    expect(rating).to.be.eql(true);
  });

  test('has the correct headers', async () => {
    const fetchStub = sinon.stub().resolves({
      status: 200,
      ok: true,
      json: () => Promise.resolve(true),
    });
    global.fetch = fetchStub;
    expect(fetchStub.calledOnce).to.be.false;
    const signal = new AbortController().signal;
    await docsChatbotAIService.addMessage({
      conversationId: '650b4b260f975ef031016c8a',
      message: 'pineapple',
      signal,
    });
    expect(fetchStub.calledOnce).to.be.true;
    expect(fetchStub.firstCall.args[0]).to.equal(
      'https://knowledge.mongodb.com/api/v1/conversations/650b4b260f975ef031016c8a/messages',
    );
    expect(fetchStub.firstCall.args[1]).to.deep.equal({
      method: 'POST',
      body: '{"message":"pineapple"}',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Origin': `vscode-mongodb-copilot-v${version}/docs`,
        'User-Agent': `mongodb-vscode/${version}`,
      },
      signal,
    });
  });
});
