import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

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

  describe('Toolbar controls', function () {
    it('should render Insert Document button', function () {
      render(<PreviewApp />);
      expect(screen.getByTitle('Insert Document')).to.exist;
    });

    it('should render Refresh button', function () {
      render(<PreviewApp />);
      expect(screen.getByTitle('Refresh')).to.exist;
    });

    it('should render Sort dropdown with options', function () {
      render(<PreviewApp />);
      // LeafyGreen Select uses combined aria-label "Sort order, Default"
      expect(screen.getByLabelText(/Sort order/)).to.exist;
    });

    it('should render Items per page dropdown', function () {
      render(<PreviewApp />);
      // LeafyGreen Select uses combined aria-label "Items per page, 10"
      expect(screen.getByLabelText(/Items per page/)).to.exist;
    });

    it('should render View type dropdown', function () {
      render(<PreviewApp />);
      // LeafyGreen Select uses combined aria-label "View type, Tree view"
      expect(screen.getByLabelText(/View type/)).to.exist;
    });

    it('should render pagination controls', function () {
      render(<PreviewApp />);
      expect(screen.getByTitle('Previous page')).to.exist;
      expect(screen.getByTitle('Next page')).to.exist;
    });

    it('should render Settings button', function () {
      render(<PreviewApp />);
      expect(screen.getByTitle('Settings')).to.exist;
    });
  });

  describe('Message handling', function () {
    it('should display documents when loadDocuments message is received', async function () {
      render(<PreviewApp />);

      // Simulate receiving documents from extension
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: { $oid: '123' }, name: 'Test' }],
              totalCount: 1,
            },
          })
        );
        // Wait for minimum loading duration
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      // Should no longer show loading
      expect(screen.queryByText('Loading documents...')).to.be.null;
      // Document should be displayed
      expect(screen.getByText('"name"')).to.exist;
    });

    it('should display "No documents" message when empty array received', async function () {
      render(<PreviewApp />);

      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [],
              totalCount: 0,
            },
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      expect(screen.getByText('No documents to display')).to.exist;
    });
  });

  describe('Refresh functionality', function () {
    it('should send refresh message when refresh button is clicked', async function () {
      render(<PreviewApp />);

      // First load documents to exit loading state
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [],
            },
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 600));
      });

      postMessageStub.resetHistory();

      // Click refresh
      const refreshButton = screen.getByTitle('Refresh');
      fireEvent.click(refreshButton);

      expect(postMessageStub).to.have.been.calledWith({
        command: PreviewMessageType.refreshDocuments,
      });
    });
  });
});

