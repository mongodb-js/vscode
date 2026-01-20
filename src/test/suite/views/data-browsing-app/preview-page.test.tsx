import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

import PreviewApp from '../../../../views/data-browsing-app/preview-page';
import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { getVSCodeApi } from '../../../../views/data-browsing-app/vscode-api';

describe('PreviewApp test suite', function () {
  let postMessageStub: sinon.SinonStub;
  let clock: sinon.SinonFakeTimers;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
    // Use fake timers for testing timeout behavior
    clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    cleanup();
    clock.restore();
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

      // Simulate receiving documents (which will hide loading after timeout)
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
        // Advance timers to complete the minimum loading duration
        clock.tick(35000);
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

    it('should immediately hide loading state when Stop button is clicked', function () {
      render(<PreviewApp />);

      // Verify initially loading
      expect(screen.getByText('Running query')).to.exist;

      const stopButton = screen.getByLabelText('Stop');
      fireEvent.click(stopButton);

      // Loading state should be hidden immediately
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should hide Stop button after clicking it', function () {
      render(<PreviewApp />);

      const stopButton = screen.getByLabelText('Stop');
      fireEvent.click(stopButton);

      // Stop button should no longer be visible
      expect(screen.queryByLabelText('Stop')).to.be.null;
    });
  });

  describe('requestCancelled message handling', function () {
    it('should reset loading state when requestCancelled message is received', function () {
      render(<PreviewApp />);

      // Verify initially loading
      expect(screen.getByText('Running query')).to.exist;

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.requestCancelled,
            },
          }),
        );
      });

      // Loading state should be hidden
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should hide Stop button when requestCancelled message is received', function () {
      render(<PreviewApp />);

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

      expect(screen.queryByLabelText('Stop')).to.be.null;
    });
  });

  describe('Timeout management and race conditions', function () {
    it('should clear pending timeout when Stop is clicked', function () {
      render(<PreviewApp />);

      // Simulate receiving documents (sets up a pending timeout)
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

      // Click Stop before the timeout fires
      const stopButton = screen.getByLabelText('Stop');
      fireEvent.click(stopButton);

      // Loading should be hidden immediately
      expect(screen.queryByText('Running query')).to.be.null;

      // Advance time past the minimum loading duration
      act(() => {
        clock.tick(35000);
      });

      // Should still not be loading (timeout was cleared)
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should clear pending timeout when requestCancelled is received', function () {
      render(<PreviewApp />);

      // Simulate receiving documents (sets up a pending timeout)
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

      // Receive cancellation message
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.requestCancelled,
            },
          }),
        );
      });

      // Loading should be hidden immediately
      expect(screen.queryByText('Running query')).to.be.null;

      // Advance time past the minimum loading duration
      act(() => {
        clock.tick(35000);
      });

      // Should still not be loading (timeout was cleared)
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should clear existing timeout when new loadDocuments message is received', function () {
      render(<PreviewApp />);

      // First loadDocuments message
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '1', name: 'First' }],
              totalCount: 1,
            },
          }),
        );
      });

      // Second loadDocuments message before first timeout fires
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '2', name: 'Second' }],
              totalCount: 1,
            },
          }),
        );
      });

      // Advance time to complete timeout
      act(() => {
        clock.tick(35000);
      });

      // Should show the second document, not the first
      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should clear existing timeout when loadPage message is received', function () {
      render(<PreviewApp />);

      // loadDocuments message
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '1', name: 'First' }],
              totalCount: 10,
            },
          }),
        );
      });

      // loadPage message before timeout fires
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadPage,
              documents: [{ _id: '2', name: 'Page2' }],
              skip: 10,
              limit: 10,
            },
          }),
        );
      });

      // Advance time to complete timeout
      act(() => {
        clock.tick(35000);
      });

      expect(screen.queryByText('Running query')).to.be.null;
    });

    it('should clear existing timeout when refreshError message is received', function () {
      render(<PreviewApp />);

      // loadDocuments message
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.loadDocuments,
              documents: [{ _id: '1', name: 'First' }],
              totalCount: 1,
            },
          }),
        );
      });

      // refreshError message before timeout fires
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              command: PreviewMessageType.refreshError,
              error: 'Connection failed',
            },
          }),
        );
      });

      // Advance time to complete timeout
      act(() => {
        clock.tick(35000);
      });

      expect(screen.queryByText('Running query')).to.be.null;
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
        // Advance timers to complete the minimum loading duration
        clock.tick(35000);
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
        // Advance timers to complete the minimum loading duration
        clock.tick(35000);
      });

      expect(screen.getByText('No documents to display')).to.exist;
    });
  });
});
