import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { DocsChatbotAIService } from '../../../participant/docsChatbotAIService';

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
    const conversation = await docsChatbotAIService.createConversation();
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
      await docsChatbotAIService.createConversation();
      expect.fail('It must fail with the server error');
    } catch (error) {
      expect((error as Error).message).to.include('Internal server error');
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
      await docsChatbotAIService.createConversation();
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
      await docsChatbotAIService.createConversation();
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
});
