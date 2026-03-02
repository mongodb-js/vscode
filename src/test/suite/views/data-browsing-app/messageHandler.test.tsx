import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { createStore } from '../../../../views/data-browsing-app/store';
import {
  handleExtensionMessage,
  setupMessageHandler,
} from '../../../../views/data-browsing-app/store/messageHandler';
import * as vscodeApi from '../../../../views/data-browsing-app/vscode-api';

describe('messageHandler test suite', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('handleExtensionMessage', function () {
    describe('loadPage', function () {
      it('should dispatch loadPage action with documents', function () {
        const store = createStore();
        const documents = [{ _id: '1', name: 'Test' }];

        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should dispatch loadPage action with documents on pagination', function () {
        const store = createStore();
        const documents = [{ _id: '11', name: 'Page2Doc' }];

        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should not reset currentPage on loadPage', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents: [{ _id: '1' }],
        });

        // loadPage action doesn't change currentPage
        expect(store.getState().documentQuery.currentPage).to.equal(1);
      });

      it('should handle empty documents array', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents: [],
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          [],
        );
      });

      it('should handle undefined documents', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          isInitialLoad: true,
        } as any);

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          [],
        );
      });

      it('should clear getDocuments error on successful load', function () {
        const store = createStore();
        // First set an error
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.getDocumentError,
          error: 'Previous error',
        });
        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Previous error',
        );

        // Then load documents successfully
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents: [{ _id: '1' }],
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.be.null;
      });
    });

    describe('getDocumentError', function () {
      it('should stop loading on document get error', function () {
        const store = createStore();
        // Initial state already has isLoading: true
        expect(store.getState().documentQuery.isLoading).to.be.true;

        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.getDocumentError,
        });

        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should set getDocuments error with provided message', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.getDocumentError,
          error: 'Connection timeout',
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Connection timeout',
        );
      });

      it('should set default error message when no error provided', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.getDocumentError,
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Failed to fetch documents',
        );
      });
    });

    describe('requestCancelled', function () {
      it('should stop loading when request is cancelled', function () {
        const store = createStore();
        // Initial state already has isLoading: true
        expect(store.getState().documentQuery.isLoading).to.be.true;

        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.requestCancelled,
        });

        expect(store.getState().documentQuery.isLoading).to.be.false;
      });
    });

    describe('updateTotalCount', function () {
      it('should set total count in collection', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCount,
          totalCount: 100,
        });

        expect(store.getState().documentQuery.totalCountForQuery).to.equal(100);
        expect(store.getState().documentQuery.hasReceivedCount).to.be.true;
      });

      it('should handle zero count', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCount,
          totalCount: 0,
        });

        expect(store.getState().documentQuery.totalCountForQuery).to.equal(0);
      });

      it('should clear getTotalCount error on successful count update', function () {
        const store = createStore();
        // First set an error
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCountError,
          error: 'Previous count error',
        });
        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Previous count error',
        );

        // Then update count successfully
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCount,
          totalCount: 50,
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.be.null;
      });
    });

    describe('updateTotalCountError', function () {
      it('should mark count as received without setting value', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCountError,
        });

        expect(store.getState().documentQuery.hasReceivedCount).to.be.true;
        expect(store.getState().documentQuery.totalCountForQuery).to.be.null;
      });

      it('should set getTotalCount error with provided message', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCountError,
          error: 'Count query timed out',
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Count query timed out',
        );
      });

      it('should set default error message when no error provided', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateTotalCountError,
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Failed to fetch total count',
        );
      });
    });

    describe('updateThemeColors', function () {
      it('should set theme colors in store', function () {
        const store = createStore();
        const themeColors = {
          key: '#ff0000',
          string: '#00ff00',
          number: '#0000ff',
          boolean: '#ffff00',
          null: '#ff00ff',
          type: '#00ffff',
          comment: '#888888',
          punctuation: '#ffffff',
        };

        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateThemeColors,
          themeColors,
          themeKind: 'vs-dark',
        });

        expect(store.getState().documentQuery.themeColors).to.deep.equal(
          themeColors,
        );
        expect(store.getState().documentQuery.themeKind).to.equal('vs-dark');
      });

      it('should handle null theme colors', function () {
        const store = createStore();
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.updateThemeColors,
          themeColors: null,
          themeKind: 'vs',
        });

        expect(store.getState().documentQuery.themeColors).to.be.null;
        expect(store.getState().documentQuery.themeKind).to.equal('vs');
      });
    });

    describe('documentDeleted', function () {
      it('should request a refresh when documentDeleted message received', function () {
        const store = createStore();

        // Ensure we start with a non-loading state
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.loadPage,
          documents: [{ _id: '1', name: 'Test' }],
        });
        expect(store.getState().documentQuery.isLoading).to.be.false;

        // Stub the API calls that documentsRefreshRequested triggers
        const sendGetDocumentsStub = sinon.stub(vscodeApi, 'sendGetDocuments');
        const sendGetTotalCountStub = sinon.stub(
          vscodeApi,
          'sendGetTotalCount',
        );

        // Trigger documentDeleted message
        handleExtensionMessage(store.dispatch, {
          command: PreviewMessageType.documentDeleted,
        });

        // State should be set to loading and refresh API functions called
        expect(store.getState().documentQuery.isLoading).to.be.true;
        expect(store.getState().documentQuery.isLoading).to.be.true;
        expect(sendGetDocumentsStub.calledOnce).to.be.true;
        expect(sendGetTotalCountStub.calledOnce).to.be.true;
      });
    });
  });

  describe('setupMessageHandler', function () {
    it('should add message event listener', function () {
      const store = createStore();
      const addEventListenerSpy = sinon.spy(window, 'addEventListener');

      setupMessageHandler(store.dispatch);

      expect(addEventListenerSpy).to.have.been.calledWith(
        'message',
        sinon.match.func,
      );
    });

    it('should return cleanup function that removes listener', function () {
      const store = createStore();
      const removeEventListenerSpy = sinon.spy(window, 'removeEventListener');

      const cleanup = setupMessageHandler(store.dispatch);
      cleanup();

      expect(removeEventListenerSpy).to.have.been.calledWith(
        'message',
        sinon.match.func,
      );
    });
  });
});
