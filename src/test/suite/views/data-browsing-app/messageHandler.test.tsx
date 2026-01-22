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
    describe('loadDocuments', function () {
      it('should dispatch loadDocuments action with documents', function () {
        const documents = [{ _id: '1', name: 'Test' }];

        handleExtensionMessage({
          command: PreviewMessageType.loadDocuments,
          documents,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
        expect(store.getState().documentQuery.currentPage).to.equal(1);
      });

      it('should handle empty documents array', function () {
        handleExtensionMessage({
          command: PreviewMessageType.loadDocuments,
          documents: [],
        });

        expect(
          store.getState().documentQuery.displayedDocuments,
        ).to.deep.equal([]);
      });

      it('should handle undefined documents', function () {
        handleExtensionMessage({
          command: PreviewMessageType.loadDocuments,
        } as any);

        expect(
          store.getState().documentQuery.displayedDocuments,
        ).to.deep.equal([]);
      });
    });

    describe('loadPage', function () {
      it('should dispatch loadPage action with documents', function () {
        const documents = [{ _id: '11', name: 'Page2Doc' }];

        handleExtensionMessage({
          command: PreviewMessageType.loadPage,
          documents,
          skip: 10,
          limit: 10,
        });

        expect(store.getState().documentQuery.displayedDocuments).to.deep.equal(
          documents,
        );
        expect(store.getState().documentQuery.isLoading).to.be.false;
      });
    });

    describe('refreshError', function () {
      it('should stop loading on refresh error', function () {
        store.dispatch(startLoading());
        expect(store.getState().documentQuery.isLoading).to.be.true;

        handleExtensionMessage({
          command: PreviewMessageType.refreshError,
        });

        expect(store.getState().documentQuery.isLoading).to.be.false;
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

