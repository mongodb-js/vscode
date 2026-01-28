import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import {
  getVSCodeApi,
  sendCancelRequest,
  sendGetDocuments,
  sendGetThemeColors,
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
    it('should send message with getDocuments command and pagination params', function () {
      sendGetDocuments(10, 25);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 10,
        limit: 25,
      });
    });

    it('should send message with getDocuments command with zero skip', function () {
      sendGetDocuments(0, 10);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });
  });

  describe('sendGetThemeColors', function () {
    it('should send message with getThemeColors command', function () {
      sendGetThemeColors();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getThemeColors,
      });
    });
  });
});
