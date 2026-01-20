import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import {
  sendCancelRequest,
  sendGetDocuments,
  sendRefreshDocuments,
  sendFetchPage,
} from '../../../../views/data-browsing-app/vscode-api';

// Access the global vscodeFake directly to avoid conflicts with other test suites
const getVscodeFake = (): { postMessage: (message: unknown) => void } => {
  return (global as any).vscodeFake;
};

describe('vscode-api test suite', function () {
  let postMessageStub: sinon.SinonStub;
  let originalPostMessage: (message: unknown) => void;

  beforeEach(function () {
    // Store original and replace with stub
    originalPostMessage = getVscodeFake().postMessage;
    postMessageStub = sinon.stub();
    getVscodeFake().postMessage = postMessageStub;
  });

  afterEach(function () {
    // Restore original
    getVscodeFake().postMessage = originalPostMessage;
    sinon.restore();
  });

  describe('sendCancelRequest', function () {
    it('should send message with cancelRequest command', function () {
      sendCancelRequest();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.cancelRequest,
      });
    });

    it('should use correct message type constant', function () {
      sendCancelRequest();

      const message = postMessageStub.firstCall.args[0];
      expect(message.command).to.equal('CANCEL_REQUEST');
    });
  });

  describe('sendGetDocuments', function () {
    it('should send message with getDocuments command', function () {
      sendGetDocuments();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.getDocuments,
      });
    });
  });

  describe('sendRefreshDocuments', function () {
    it('should send message with refreshDocuments command', function () {
      sendRefreshDocuments();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.refreshDocuments,
      });
    });
  });

  describe('sendFetchPage', function () {
    it('should send message with fetchPage command and pagination params', function () {
      sendFetchPage(10, 25);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.fetchPage,
        skip: 10,
        limit: 25,
      });
    });

    it('should handle skip of 0 correctly', function () {
      sendFetchPage(0, 50);

      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.fetchPage,
        skip: 0,
        limit: 50,
      });
    });
  });
});
