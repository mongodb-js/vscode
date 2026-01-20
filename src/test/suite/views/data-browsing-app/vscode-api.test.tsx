import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import {
  getVSCodeApi,
  sendCancelRequest,
  sendGetDocuments,
  sendRefreshDocuments,
  sendFetchPage,
} from '../../../../views/data-browsing-app/vscode-api';

describe('vscode-api test suite', function () {
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getVSCodeApi', function () {
    it('should return the same instance on subsequent calls (singleton)', function () {
      const first = getVSCodeApi();
      const second = getVSCodeApi();
      expect(first).to.equal(second);
    });
  });

  describe('sendCancelRequest', function () {
    it('should send message with cancelRequest command', function () {
      sendCancelRequest();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.cancelRequest,
      });
    });
  });

  describe('sendGetDocuments', function () {
    it('should send message with getDocuments command', function () {
      sendGetDocuments();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
      });
    });
  });

  describe('sendRefreshDocuments', function () {
    it('should send message with refreshDocuments command', function () {
      sendRefreshDocuments();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.refreshDocuments,
      });
    });
  });

  describe('sendFetchPage', function () {
    it('should send message with fetchPage command and pagination params', function () {
      sendFetchPage(10, 25);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.fetchPage,
        skip: 10,
        limit: 25,
      });
    });
  });
});
