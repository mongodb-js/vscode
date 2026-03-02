import { beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import {
  DocsChatbotAIService,
  type DocsStreamResult,
} from '../../../participant/docsChatbotAIService';

suite('DocsChatbotAIService Test Suite', function () {
  let docsChatbotAIService: DocsChatbotAIService;

  beforeEach(() => {
    docsChatbotAIService = new DocsChatbotAIService();
  });

  afterEach(function () {
    sinon.restore();
  });

  test('respects MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE env variable', function () {
    process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE =
      'https://custom.mongodb.com';
    const service = new DocsChatbotAIService();
    expect(service._serverBaseUri).to.equal('https://custom.mongodb.com');
    delete process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE;
  });

  test('uses default base URI when override is not set', function () {
    delete process.env.MONGODB_DOCS_CHATBOT_BASE_URI_OVERRIDE;
    const service = new DocsChatbotAIService();
    expect(service._serverBaseUri).to.equal('https://knowledge.mongodb.com');
  });
});
