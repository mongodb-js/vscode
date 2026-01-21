import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
} from '@testing-library/react';

import PreviewApp from '../../../../views/data-browsing-app/preview-page';
import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { getVSCodeApi } from '../../../../views/data-browsing-app/vscode-api';

describe('PreviewApp test suite', function () {
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
  });

  afterEach(function () {
    cleanup();
    sinon.restore();
  });

  describe('Initial state', function () {
    it('should show loading state initially', function () {
      render(<PreviewApp />);
      expect(screen.getByText('Running query')).to.exist;
    });

    it('should request initial documents on mount', function () {
      render(<PreviewApp />);
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
      });
    });

    it('should show Stop button when loading', function () {
      render(<PreviewApp />);
      const stopButton = screen.getByLabelText('Stop');
      expect(stopButton).to.exist;
      // The button should be present with Stop text
      expect(stopButton.textContent).to.include('Stop');
    });
  });

  describe('Stop button UI', function () {
    it('should show Stop button only when isLoading is true', function () {
      render(<PreviewApp />);

      // Initially loading - Stop button should be visible
      expect(screen.getByLabelText('Stop')).to.exist;

      // Simulate receiving documents (which will hide loading immediately)
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '123', name: 'Test' }],
              totalCount: 1,
            },
          }),
        );
      });

      // Stop button should not be visible when not loading
      expect(screen.queryByLabelText('Stop')).to.be.null;
    });

    it('should render Stop button as a vscode-button element', function () {
      render(<PreviewApp />);
      const stopButton = screen.getByLabelText('Stop');
      // Verify it's a vscode-button web component
      expect(stopButton.tagName.toLowerCase()).to.equal('vscode-button');
    });
  });

  describe('handleStop function', function () {
    it('should send cancelRequest message when Stop button is clicked', function () {
      render(<PreviewApp />);

      const stopButton = screen.getByLabelText('Stop');
      fireEvent.click(stopButton);

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.cancelRequest,
      });
    });

    it('should immediately hide loading state and Stop button when Stop is clicked', function () {
      render(<PreviewApp />);

      // Verify initially loading with Stop button visible
      expect(screen.getByText('Running query')).to.exist;
      expect(screen.getByLabelText('Stop')).to.exist;

      const stopButton = screen.getByLabelText('Stop');
      fireEvent.click(stopButton);

      // Both loading state and Stop button should be hidden immediately
      expect(screen.queryByText('Running query')).to.be.null;
      expect(screen.queryByLabelText('Stop')).to.be.null;
    });
  });

  describe('requestCancelled message handling', function () {
    it('should reset loading state and hide Stop button when requestCancelled is received', function () {
      render(<PreviewApp />);

      // Verify initially loading with Stop button visible
      expect(screen.getByText('Running query')).to.exist;
      expect(screen.getByLabelText('Stop')).to.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.requestCancelled,
            },
          }),
        );
      });

      // Both loading state and Stop button should be hidden
      expect(screen.queryByText('Running query')).to.be.null;
      expect(screen.queryByLabelText('Stop')).to.be.null;
    });
  });

  describe('Message handling', function () {
    it('should display documents when loadDocuments message is received', function () {
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
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should display empty state when no documents received', function () {
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

      expect(screen.getByText('No documents to display')).to.exist;
    });
  });

  describe('Refresh functionality', function () {
    // Helper to complete initial loading
    function completeInitialLoading(): void {
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '1', name: 'Doc1' }],
              totalCount: 1,
            },
          }),
        );
      });
    }

    it('should send refreshDocuments when clicked after loading completes', function () {
      render(<PreviewApp />);
      completeInitialLoading();

      // Reset stub to clear previous calls
      postMessageStub.resetHistory();

      const refreshButton = screen.getByLabelText('Refresh');
      fireEvent.click(refreshButton);

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.refreshDocuments,
      });
    });

    it('should show loading state when Refresh is clicked', function () {
      render(<PreviewApp />);
      completeInitialLoading();

      // Verify not loading
      expect(screen.queryByText('Running query')).to.be.null;

      const refreshButton = screen.getByLabelText('Refresh');
      fireEvent.click(refreshButton);

      // Should show loading
      expect(screen.getByText('Running query')).to.exist;
    });
  });

  describe('Pagination', function () {
    // Helper to load documents with pagination
    function loadDocumentsWithPagination(
      totalCount: number,
      documentCount = 10,
    ): void {
      const documents = Array.from({ length: documentCount }, (_, i) => ({
        _id: String(i + 1),
        name: `Doc${i + 1}`,
      }));

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents,
              totalCount,
            },
          }),
        );
      });
    }

    it('should not navigate to previous page when on first page', function () {
      render(<PreviewApp />);
      loadDocumentsWithPagination(50);

      postMessageStub.resetHistory();

      // Click Previous on first page - should not send fetchPage
      const prevButton = screen.getByLabelText('Previous page');
      fireEvent.click(prevButton);

      // Should not have sent any fetchPage message
      expect(
        postMessageStub.calledWithMatch({
          command: PreviewMessageType.fetchPage,
        }),
      ).to.be.false;
    });

    it('should send fetchPage message when Next button is clicked', function () {
      render(<PreviewApp />);
      loadDocumentsWithPagination(50);

      postMessageStub.resetHistory();

      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(nextButton);

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.fetchPage,
        skip: 10,
        limit: 10,
      });
    });

    it('should not navigate to next page when on last page', function () {
      render(<PreviewApp />);
      // Load only 5 documents with totalCount of 5 (fits on one page)
      loadDocumentsWithPagination(5, 5);

      postMessageStub.resetHistory();

      // Click Next on last page - should not send fetchPage
      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(nextButton);

      // Should not have sent any fetchPage message
      expect(
        postMessageStub.calledWithMatch({
          command: PreviewMessageType.fetchPage,
        }),
      ).to.be.false;
    });

    it('should display correct pagination info', function () {
      render(<PreviewApp />);
      loadDocumentsWithPagination(50);

      // Should show "1-10 of 50"
      expect(screen.getByText('1-10 of 50')).to.exist;
    });

    it('should not navigate when pagination buttons clicked while loading', function () {
      render(<PreviewApp />);

      // Reset stub to clear initial getDocuments call
      postMessageStub.resetHistory();

      // Click pagination buttons while loading
      const prevButton = screen.getByLabelText('Previous page');
      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(prevButton);
      fireEvent.click(nextButton);

      // Should not have sent any fetchPage messages
      expect(
        postMessageStub.calledWithMatch({
          command: PreviewMessageType.fetchPage,
        }),
      ).to.be.false;
    });
  });

  describe('Items per page', function () {
    it('should render items per page dropdown with default value', function () {
      render(<PreviewApp />);

      const dropdown = screen.getByLabelText('Items per page');
      expect(dropdown).to.exist;
    });
  });

  describe('Document content verification', function () {
    it('should render document JSON content after loading', function () {
      render(<PreviewApp />);

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '123', name: 'TestDocument', value: 42 }],
              totalCount: 1,
            },
          }),
        );
      });

      // Should render the document content
      expect(screen.getByText(/"_id":\s*"123"/)).to.exist;
    });

    it('should render multiple documents', function () {
      render(<PreviewApp />);

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [
                { _id: '1', name: 'First' },
                { _id: '2', name: 'Second' },
              ],
              totalCount: 2,
            },
          }),
        );
      });

      // Both documents should be rendered
      expect(screen.getByText(/"_id":\s*"1"/)).to.exist;
      expect(screen.getByText(/"_id":\s*"2"/)).to.exist;
    });
  });

  describe('loadPage message handling', function () {
    it('should update documents when loadPage message is received', function () {
      render(<PreviewApp />);

      // First load initial documents
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '1', name: 'FirstPage' }],
              totalCount: 20,
            },
          }),
        );
      });

      // Then receive page 2 documents
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadPage,
              documents: [{ _id: '11', name: 'SecondPage' }],
              skip: 10,
              limit: 10,
            },
          }),
        );
      });

      // Should show the new document
      expect(screen.getByText(/"_id":\s*"11"/)).to.exist;
      // Should not show the old document
      expect(screen.queryByText(/"_id":\s*"1"/)).to.be.null;
    });
  });
});
