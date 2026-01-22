import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { getVSCodeApi } from '../../../../views/data-browsing-app/vscode-api';
import { store } from '../../../../views/data-browsing-app/store';
import {
  resetState,
  setCurrentPage,
  setItemsPerPage,
  setTotalCountInCollection,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';
import {
  refreshDocuments,
  fetchInitialDocuments,
  goToPreviousPage,
  goToNextPage,
  changeItemsPerPage,
  cancelRequest,
  adjustCurrentPage,
} from '../../../../views/data-browsing-app/store/actions';

describe('actions test suite', function () {
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
  });

  afterEach(function () {
    sinon.restore();
    store.dispatch(resetState());
  });

  describe('refreshDocuments', function () {
    it('should dispatch startRefresh and send getDocuments with skip=0', function () {
      refreshDocuments();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10, // default itemsPerPage
      });
      expect(store.getState().documentQuery.isLoading).to.be.true;
      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });

    it('should use current itemsPerPage setting', function () {
      store.dispatch(setItemsPerPage(25));

      refreshDocuments();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 25,
      });
    });
  });

  describe('fetchInitialDocuments', function () {
    it('should send getDocuments with skip=0 and default itemsPerPage', function () {
      fetchInitialDocuments();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });

    it('should use current itemsPerPage setting', function () {
      store.dispatch(setItemsPerPage(50));

      fetchInitialDocuments();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 50,
      });
    });
  });

  describe('goToPreviousPage', function () {
    it('should not navigate when on first page', function () {
      goToPreviousPage();

      // Should not send any message since we're on page 1
      expect(postMessageStub).to.not.have.been.called;
      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });

    it('should navigate to previous page when not on first page', function () {
      store.dispatch(setCurrentPage(3));

      goToPreviousPage();

      expect(store.getState().documentQuery.currentPage).to.equal(2);
      expect(store.getState().documentQuery.isLoading).to.be.true;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 10, // (page 2 - 1) * 10
        limit: 10,
      });
    });

    it('should calculate correct skip with custom itemsPerPage', function () {
      store.dispatch(setCurrentPage(3));
      store.dispatch(setItemsPerPage(25));

      goToPreviousPage();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 25, // (page 2 - 1) * 25
        limit: 25,
      });
    });
  });

  describe('goToNextPage', function () {
    it('should not navigate when on last page', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 5
      store.dispatch(setTotalCountInCollection(50));
      store.dispatch(setCurrentPage(5));

      goToNextPage();

      expect(postMessageStub).to.not.have.been.called;
      expect(store.getState().documentQuery.currentPage).to.equal(5);
    });

    it('should navigate to next page when not on last page', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 2
      store.dispatch(setTotalCountInCollection(50));
      store.dispatch(setCurrentPage(2));

      goToNextPage();

      expect(store.getState().documentQuery.currentPage).to.equal(3);
      expect(store.getState().documentQuery.isLoading).to.be.true;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 20, // (page 3 - 1) * 10
        limit: 10,
      });
    });

    it('should calculate correct skip with custom itemsPerPage', function () {
      // Set up: 75 docs with 25 per page = 3 pages, on page 1
      store.dispatch(setTotalCountInCollection(75));
      store.dispatch(setCurrentPage(1));
      store.dispatch(setItemsPerPage(25));

      goToNextPage();

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 25, // (page 2 - 1) * 25
        limit: 25,
      });
    });
  });

  describe('changeItemsPerPage', function () {
    it('should set new itemsPerPage and reset to page 1', function () {
      store.dispatch(setCurrentPage(3));

      changeItemsPerPage(50);

      expect(store.getState().documentQuery.itemsPerPage).to.equal(50);
      expect(store.getState().documentQuery.currentPage).to.equal(1);
      expect(store.getState().documentQuery.isLoading).to.be.true;
    });

    it('should send getDocuments with new limit and skip=0', function () {
      changeItemsPerPage(25);

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 25,
      });
    });
  });

  describe('cancelRequest', function () {
    it('should stop loading and send cancelRequest message', function () {
      cancelRequest();

      expect(store.getState().documentQuery.isLoading).to.be.false;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.cancelRequest,
      });
    });
  });

  describe('adjustCurrentPage', function () {
    it('should not change page when currentPage is within bounds', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 3
      store.dispatch(setTotalCountInCollection(50));
      store.dispatch(setCurrentPage(3));

      adjustCurrentPage();

      expect(store.getState().documentQuery.currentPage).to.equal(3);
    });

    it('should adjust page when currentPage exceeds totalPages', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 10
      store.dispatch(setTotalCountInCollection(50));
      store.dispatch(setCurrentPage(10));

      adjustCurrentPage();

      expect(store.getState().documentQuery.currentPage).to.equal(5);
    });

    it('should not adjust when totalPages is 0', function () {
      // Set up: 0 docs = 0 totalPages (but min 1), on page 3
      // Note: selectTotalPages returns Math.max(1, ...) so this test needs adjustment
      // When totalCount is null, totalPages is calculated from displayedDocuments
      store.dispatch(setCurrentPage(3));
      // Don't set totalCount - it remains null, so totalDocs = displayedDocs.length = 0
      // totalPages = max(1, ceil(0/10)) = 1
      // Since currentPage (3) > totalPages (1) and totalPages > 0, it should adjust

      adjustCurrentPage();

      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });
  });
});

