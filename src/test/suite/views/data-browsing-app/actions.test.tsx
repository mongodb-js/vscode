import { expect } from 'chai';
import sinon from 'sinon';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import { getVSCodeApi } from '../../../../views/data-browsing-app/vscode-api';
import { createStore } from '../../../../views/data-browsing-app/store';
import {
  initialState,
  documentsRefreshRequested,
  initialDocumentsFetchRequested,
  previousPageRequested,
  nextPageRequested,
  itemsPerPageChanged,
  sortChanged,
  requestCancellationRequested,
  currentPageAdjusted,
  SORT_OPTIONS,
  type DocumentQueryState,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';

const createTestState = (
  overrides: Partial<DocumentQueryState> = {},
): { documentQuery: DocumentQueryState } => {
  const state = { ...initialState, ...overrides };

  // Recalculate computed pagination values based on overrides
  state.totalDocuments =
    state.totalCountForQuery !== null
      ? state.totalCountForQuery
      : state.displayedDocuments.length;
  state.totalPages = Math.max(
    1,
    Math.ceil(state.totalDocuments / state.itemsPerPage),
  );
  state.startItem =
    state.totalDocuments === 0
      ? 0
      : (state.currentPage - 1) * state.itemsPerPage + 1;
  state.endItem = Math.min(
    state.currentPage * state.itemsPerPage,
    state.totalDocuments,
  );

  return { documentQuery: state };
};

/**
 * Helper function to find a sort option by its sort field value.
 * Makes tests more readable than using array indices.
 */
const findSortOption = (
  sortField: '_id',
  sortDirection: 1 | -1,
): (typeof SORT_OPTIONS)[number] => {
  const option = SORT_OPTIONS.find(
    (opt) => opt.sort?.[sortField] === sortDirection,
  );
  if (!option) {
    throw new Error(`Sort option not found for ${sortField}: ${sortDirection}`);
  }
  return option;
};

describe('actions test suite', function () {
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('documentsRefreshRequested', function () {
    it('should dispatch startRefresh and send getDocuments with skip=0', function () {
      const store = createStore();
      store.dispatch(documentsRefreshRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10, // default itemsPerPage
      });
      expect(store.getState().documentQuery.isLoading).to.be.true;
      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });

    it('should use current itemsPerPage setting', function () {
      const store = createStore(createTestState({ itemsPerPage: 25 }));

      store.dispatch(documentsRefreshRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 25,
      });
    });
  });

  describe('initialDocumentsFetchRequested', function () {
    it('should send getDocuments with skip=0 and default itemsPerPage', function () {
      const store = createStore();
      store.dispatch(initialDocumentsFetchRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });

    it('should use current itemsPerPage setting', function () {
      const store = createStore(createTestState({ itemsPerPage: 50 }));

      store.dispatch(initialDocumentsFetchRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 50,
      });
    });

    it('should include sort when store has a pre-configured default sort', function () {
      const sortOption = findSortOption('_id', -1);
      const store = createStore(createTestState({ sort: sortOption }));

      store.dispatch(initialDocumentsFetchRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
        sort: { _id: -1 },
      });
    });

    it('should not include sort field when store has no default sort', function () {
      const store = createStore(createTestState({ sort: null }));

      store.dispatch(initialDocumentsFetchRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });
  });

  describe('previousPageRequested', function () {
    it('should not navigate when on first page', function () {
      const store = createStore();
      store.dispatch(previousPageRequested());

      // Should not send any message since we're on page 1
      expect(postMessageStub).to.not.have.been.called;
      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });

    it('should navigate to previous page when not on first page', function () {
      const store = createStore(
        createTestState({ currentPage: 3, isLoading: false }),
      );

      store.dispatch(previousPageRequested());

      expect(store.getState().documentQuery.currentPage).to.equal(2);
      expect(store.getState().documentQuery.isLoading).to.be.true;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 10, // (page 2 - 1) * 10
        limit: 10,
      });
    });

    it('should calculate correct skip with custom itemsPerPage', function () {
      const store = createStore(
        createTestState({ currentPage: 3, itemsPerPage: 25, isLoading: false }),
      );

      store.dispatch(previousPageRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 25, // (page 2 - 1) * 25
        limit: 25,
      });
    });
  });

  describe('nextPageRequested', function () {
    it('should not navigate when on last page', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 5
      const store = createStore(
        createTestState({ totalCountForQuery: 50, currentPage: 5 }),
      );

      store.dispatch(nextPageRequested());

      expect(postMessageStub).to.not.have.been.called;
      expect(store.getState().documentQuery.currentPage).to.equal(5);
    });

    it('should navigate to next page when not on last page', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 2
      const store = createStore(
        createTestState({
          totalCountForQuery: 50,
          currentPage: 2,
          isLoading: false,
        }),
      );

      store.dispatch(nextPageRequested());

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
      const store = createStore(
        createTestState({
          totalCountForQuery: 75,
          currentPage: 1,
          itemsPerPage: 25,
          isLoading: false,
        }),
      );

      store.dispatch(nextPageRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 25, // (page 2 - 1) * 25
        limit: 25,
      });
    });
  });

  describe('itemsPerPageChanged', function () {
    it('should set new itemsPerPage and reset to page 1', function () {
      const store = createStore(createTestState({ currentPage: 3 }));

      store.dispatch(itemsPerPageChanged(50));

      expect(store.getState().documentQuery.itemsPerPage).to.equal(50);
      expect(store.getState().documentQuery.currentPage).to.equal(1);
      expect(store.getState().documentQuery.isLoading).to.be.true;
    });

    it('should send getDocuments with new limit and skip=0', function () {
      const store = createStore();
      store.dispatch(itemsPerPageChanged(25));

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 25,
      });
    });
  });

  describe('sortChanged', function () {
    it('should set sort and reset to page 1', function () {
      const store = createStore(createTestState({ currentPage: 3 }));
      const sortOption = findSortOption('_id', 1);

      store.dispatch(sortChanged(sortOption));

      expect(store.getState().documentQuery.sort).to.deep.equal(sortOption);
      expect(store.getState().documentQuery.currentPage).to.equal(1);
      expect(store.getState().documentQuery.isLoading).to.be.true;
    });

    it('should send getDocuments with sort and skip=0', function () {
      const store = createStore();
      const sortOption = findSortOption('_id', -1);

      store.dispatch(sortChanged(sortOption));

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
        sort: { _id: -1 },
      });
    });

    it('should send getDocuments without sort field when set to null (default)', function () {
      const sortOption = findSortOption('_id', 1);
      const store = createStore(createTestState({ sort: sortOption }));
      store.dispatch(sortChanged(null));

      expect(store.getState().documentQuery.sort).to.be.null;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });

    it('should preserve sort when navigating pages', function () {
      const sortOption = findSortOption('_id', 1);
      const store = createStore(
        createTestState({
          sort: sortOption,
          totalCountForQuery: 50,
          currentPage: 1,
          isLoading: false,
        }),
      );

      store.dispatch(nextPageRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 10,
        limit: 10,
        sort: { _id: 1 },
      });
    });

    it('should preserve sort when refreshing', function () {
      const sortOption = findSortOption('_id', -1);
      const store = createStore(createTestState({ sort: sortOption }));

      store.dispatch(documentsRefreshRequested());

      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
        sort: { _id: -1 },
      });
    });
  });

  describe('requestCancellationRequested', function () {
    it('should stop loading and send cancelRequest message', function () {
      const store = createStore();
      store.dispatch(requestCancellationRequested());

      expect(store.getState().documentQuery.isLoading).to.be.false;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.cancelRequest,
      });
    });
  });

  describe('currentPageAdjusted', function () {
    it('should not change page when currentPage is within bounds', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 3
      const store = createStore(
        createTestState({ totalCountForQuery: 50, currentPage: 3 }),
      );

      store.dispatch(currentPageAdjusted());

      expect(store.getState().documentQuery.currentPage).to.equal(3);
    });

    it('should adjust page when currentPage exceeds totalPages', function () {
      // Set up: 50 docs with 10 per page = 5 pages, on page 10
      const store = createStore(
        createTestState({ totalCountForQuery: 50, currentPage: 10 }),
      );

      store.dispatch(currentPageAdjusted());

      expect(store.getState().documentQuery.currentPage).to.equal(5);
    });

    it('should adjust when currentPage exceeds calculated totalPages', function () {
      // Set up: 0 docs = totalPages = max(1, ceil(0/10)) = 1, on page 3
      // When totalCount is null, totalPages is calculated from displayedDocuments
      // Since currentPage (3) > totalPages (1) and totalPages > 0, it should adjust
      const store = createStore(createTestState({ currentPage: 3 }));

      store.dispatch(currentPageAdjusted());

      expect(store.getState().documentQuery.currentPage).to.equal(1);
    });
  });
});
