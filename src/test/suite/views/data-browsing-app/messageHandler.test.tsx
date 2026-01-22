import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { store } from '../../../../views/data-browsing-app/store';
import {
  resetState,
  startLoading,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';
import {
  handleExtensionMessage,
  setupMessageHandler,
} from '../../../../views/data-browsing-app/store/messageHandler';

describe('messageHandler test suite', function () {
  afterEach(function () {
    sinon.restore();
    store.dispatch(resetState());
  });

  describe('handleExtensionMessage', function () {
    describe('loadPage', function () {
      it('should dispatch loadPage action with documents', function () {
        const documents = [{ _id: '1', name: 'Test' }];

        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should dispatch loadPage action with documents on pagination', function () {
        const documents = [{ _id: '11', name: 'Page2Doc' }];

        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should not reset currentPage on loadPage', function () {
        // Set page to something other than 1
        store.dispatch(startLoading());

        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents: [{ _id: '1' }],
        });

        // loadPage action doesn't change currentPage
        expect(store.getState().documentQuery.currentPage).to.equal(1);
      });

      it('should handle empty documents array', function () {
        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents: [],
        });

        expect(
          store.getState().documentQuery.displayedDocuments,
        ).to.deep.equal([]);
      });

      it('should handle undefined documents', function () {
        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          isInitialLoad: true,
        } as any);

        expect(
          store.getState().documentQuery.displayedDocuments,
        ).to.deep.equal([]);
      });

      it('should clear getDocuments error on successful load', function () {
        // First set an error
        handleExtensionMessage({
          command: PreviewMessageType.getDocumentError,
          error: 'Previous error',
        });
        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Previous error',
        );

        // Then load documents successfully
        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents: [{ _id: '1' }],
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.be.null;
      });
    });

    describe('getDocumentError', function () {
      it('should stop loading on document get error', function () {
        store.dispatch(startLoading());
        expect(store.getState().documentQuery.isLoading).to.be.true;

        handleExtensionMessage({
          command: PreviewMessageType.getDocumentError,
        });

        expect(store.getState().documentQuery.isLoading).to.be.false;
      });

      it('should set getDocuments error with provided message', function () {
        handleExtensionMessage({
          command: PreviewMessageType.getDocumentError,
          error: 'Connection timeout',
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Connection timeout',
        );
      });

      it('should set default error message when no error provided', function () {
        handleExtensionMessage({
          command: PreviewMessageType.getDocumentError,
        });

        expect(store.getState().documentQuery.errors.getDocuments).to.equal(
          'Failed to fetch documents',
        );
      });
    });

    describe('requestCancelled', function () {
      it('should stop loading when request is cancelled', function () {
        store.dispatch(startLoading());
        expect(store.getState().documentQuery.isLoading).to.be.true;

        handleExtensionMessage({
          command: PreviewMessageType.requestCancelled,
        });

        expect(store.getState().documentQuery.isLoading).to.be.false;
      });
    });

    describe('updateTotalCount', function () {
      it('should set total count in collection', function () {
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCount,
          totalCount: 100,
        });

        expect(
          store.getState().documentQuery.totalCountInCollection,
        ).to.equal(100);
        expect(store.getState().documentQuery.hasReceivedCount).to.be.true;
      });

      it('should handle zero count', function () {
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCount,
          totalCount: 0,
        });

        expect(
          store.getState().documentQuery.totalCountInCollection,
        ).to.equal(0);
      });

      it('should clear getTotalCount error on successful count update', function () {
        // First set an error
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCountError,
          error: 'Previous count error',
        });
        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Previous count error',
        );

        // Then update count successfully
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCount,
          totalCount: 50,
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.be.null;
      });
    });

    describe('updateTotalCountError', function () {
      it('should mark count as received without setting value', function () {
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCountError,
        });

        expect(store.getState().documentQuery.hasReceivedCount).to.be.true;
        expect(
          store.getState().documentQuery.totalCountInCollection,
        ).to.be.null;
      });

      it('should set getTotalCount error with provided message', function () {
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCountError,
          error: 'Count query timed out',
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Count query timed out',
        );
      });

      it('should set default error message when no error provided', function () {
        handleExtensionMessage({
          command: PreviewMessageType.updateTotalCountError,
        });

        expect(store.getState().documentQuery.errors.getTotalCount).to.equal(
          'Failed to fetch total count',
        );
      });
    });
  });

  describe('setupMessageHandler', function () {
    it('should add message event listener', function () {
      const addEventListenerSpy = sinon.spy(window, 'addEventListener');

      setupMessageHandler();

      expect(addEventListenerSpy).to.have.been.calledWith(
        'message',
        sinon.match.func,
      );
    });

    it('should return cleanup function that removes listener', function () {
      const removeEventListenerSpy = sinon.spy(window, 'removeEventListener');

      const cleanup = setupMessageHandler();
      cleanup();

      expect(removeEventListenerSpy).to.have.been.calledWith(
        'message',
        sinon.match.func,
      );
    });
  });
});

