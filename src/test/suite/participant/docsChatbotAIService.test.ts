import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { DocsChatbotAIService } from '../../../participant/docsChatbotAIService';

suite('DocsChatbotAIService Test Suite', function () {
  let service: DocsChatbotAIService;
  let originalEnv: typeof process.env;

  beforeEach(function () {
    originalEnv = process.env;
    service = new DocsChatbotAIService();
  });

  afterEach(function () {
    sinon.restore();
    process.env = originalEnv;
  });

  test('respects MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE env variable', function () {
    process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE =
      'https://custom.mongodb.com';
    expect(service._serverBaseUri).to.equal('https://custom.mongodb.com');
    delete process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE;
  });

  test('uses default base URI when override is not set', function () {
    delete process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE;
    expect(service._serverBaseUri).to.equal('https://knowledge.mongodb.com');
  });
});
