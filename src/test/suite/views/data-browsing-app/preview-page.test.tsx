import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, screen, act, cleanup } from '@testing-library/react';

import PreviewApp from '../../../../views/data-browsing-app/preview-page';
import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';

// Access the global vscodeFake directly to avoid conflicts with other test suites
const getVscodeFake = (): { postMessage: (message: unknown) => void } => {
  return (global as any).vscodeFake;
};

describe('PreviewApp test suite', function () {
  let postMessageStub: sinon.SinonStub;
  let originalPostMessage: (message: unknown) => void;

  beforeEach(function () {
    // Store original and replace with stub
    originalPostMessage = getVscodeFake().postMessage;
    postMessageStub = sinon.stub();
    getVscodeFake().postMessage = postMessageStub;
  });

  afterEach(function () {
    cleanup();
    // Restore original
    getVscodeFake().postMessage = originalPostMessage;
    sinon.restore();
  });

  describe('Initial state', function () {
    it('should show loading state initially', function () {
      render(<PreviewApp />);
      expect(screen.getByText('Loading documents...')).to.exist;
    });

    it('should request initial documents on mount', function () {
      render(<PreviewApp />);
      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.getDocuments,
      });
    });
  });

  describe('Message handling', function () {
    it('should display document count when loadDocuments message is received', function () {
      render(<PreviewApp />);

      // Simulate receiving documents from extension
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: { $oid: '123' }, name: 'Test' }],
              totalCount: 1,
            },
          }),
        );
      });

      // Should no longer show loading
      expect(screen.queryByText('Loading documents...')).to.be.null;
      // Should display document count message
      expect(screen.getByText(/We have 1 documents/)).to.exist;
    });

    it('should display zero documents message when empty array received', function () {
      render(<PreviewApp />);

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [],
              totalCount: 0,
            },
          }),
        );
      });

      expect(screen.getByText(/We have 0 documents/)).to.exist;
    });
  });
});
