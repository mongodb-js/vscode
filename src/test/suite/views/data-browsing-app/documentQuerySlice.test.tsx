import { expect } from 'chai';
import reducer, {
  setDisplayedDocuments,
  loadPage,
  setCurrentPage,
  setItemsPerPage,
  setIsLoading,
  startLoading,
  stopLoading,
  setTotalCountInCollection,
  markCountReceived,
  setError,
  resetState,
  startRefresh,
  selectDisplayedDocuments,
  selectCurrentPage,
  selectItemsPerPage,
  selectIsLoading,
  selectTotalCountInCollection,
  selectHasReceivedCount,
  selectError,
  selectIsCountAvailable,
  selectTotalDocuments,
  selectTotalPages,
  selectStartItem,
  selectEndItem,
  type DocumentQueryState,
  type PreviewDocument,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';

describe('documentQuerySlice', function () {
  const initialState: DocumentQueryState = {
    displayedDocuments: [],
    currentPage: 1,
    itemsPerPage: 10,
    isLoading: true,
    totalCountInCollection: null,
    hasReceivedCount: false,
    error: null,
    errors: {
      getDocuments: null,
      getTotalCount: null,
    },
  };

  const createState = (
    overrides: Partial<DocumentQueryState> = {},
  ): { documentQuery: DocumentQueryState } => ({
    documentQuery: { ...initialState, ...overrides },
  });

  describe('Initial state', function () {
    it('should return the initial state when passed undefined', function () {
      const result = reducer(undefined, { type: 'unknown' });
      expect(result).to.deep.equal(initialState);
    });

    it('should have correct initial values', function () {
      const result = reducer(undefined, { type: 'unknown' });
      expect(result.displayedDocuments).to.deep.equal([]);
      expect(result.currentPage).to.equal(1);
      expect(result.itemsPerPage).to.equal(10);
      expect(result.isLoading).to.be.true;
      expect(result.totalCountInCollection).to.be.null;
      expect(result.hasReceivedCount).to.be.false;
      expect(result.error).to.be.null;
    });
  });

  describe('Action creators and reducers', function () {
    describe('setDisplayedDocuments', function () {
      it('should set displayed documents', function () {
        const documents: PreviewDocument[] = [{ _id: '1', name: 'Doc1' }];
        const result = reducer(initialState, setDisplayedDocuments(documents));
        expect(result.displayedDocuments).to.deep.equal(documents);
      });

      it('should replace existing documents', function () {
        const state = { ...initialState, displayedDocuments: [{ _id: 'old' }] };
        const newDocs = [{ _id: 'new' }];
        const result = reducer(state, setDisplayedDocuments(newDocs));
        expect(result.displayedDocuments).to.deep.equal(newDocs);
      });
    });

    describe('loadPage', function () {
      it('should set documents and stop loading', function () {
        const state = { ...initialState, currentPage: 3, isLoading: true };
        const documents: PreviewDocument[] = [{ _id: '1' }];
        const result = reducer(state, loadPage(documents));
        expect(result.displayedDocuments).to.deep.equal(documents);
        expect(result.currentPage).to.equal(3);
        expect(result.isLoading).to.be.false;
        expect(result.error).to.be.null;
      });

      it('should clear any existing error', function () {
        const state = { ...initialState, error: 'Previous error' };
        const result = reducer(state, loadPage([]));
        expect(result.error).to.be.null;
      });
    });

    describe('setCurrentPage', function () {
      it('should set current page', function () {
        const result = reducer(initialState, setCurrentPage(5));
        expect(result.currentPage).to.equal(5);
      });
    });

    describe('setItemsPerPage', function () {
      it('should set items per page', function () {
        const result = reducer(initialState, setItemsPerPage(25));
        expect(result.itemsPerPage).to.equal(25);
      });
    });

    describe('setIsLoading', function () {
      it('should set loading state to true', function () {
        const state = { ...initialState, isLoading: false };
        const result = reducer(state, setIsLoading(true));
        expect(result.isLoading).to.be.true;
      });

      it('should set loading state to false', function () {
        const result = reducer(initialState, setIsLoading(false));
        expect(result.isLoading).to.be.false;
      });
    });

    describe('startLoading', function () {
      it('should set loading to true and clear error', function () {
        const state = {
          ...initialState,
          isLoading: false,
          error: 'Some error',
        };
        const result = reducer(state, startLoading());
        expect(result.isLoading).to.be.true;
        expect(result.error).to.be.null;
      });
    });

    describe('stopLoading', function () {
      it('should set loading to false', function () {
        const result = reducer(initialState, stopLoading());
        expect(result.isLoading).to.be.false;
      });
    });

    describe('setTotalCountInCollection', function () {
      it('should set total count and mark as received', function () {
        const result = reducer(initialState, setTotalCountInCollection(100));
        expect(result.totalCountInCollection).to.equal(100);
        expect(result.hasReceivedCount).to.be.true;
      });

      it('should handle null count', function () {
        const state = { ...initialState, totalCountInCollection: 50 };
        const result = reducer(state, setTotalCountInCollection(null));
        expect(result.totalCountInCollection).to.be.null;
        expect(result.hasReceivedCount).to.be.true;
      });
    });

    describe('markCountReceived', function () {
      it('should mark count as received without setting value', function () {
        const result = reducer(initialState, markCountReceived());
        expect(result.hasReceivedCount).to.be.true;
        expect(result.totalCountInCollection).to.be.null;
      });
    });

    describe('setError', function () {
      it('should set error and stop loading', function () {
        const result = reducer(initialState, setError('Something went wrong'));
        expect(result.error).to.equal('Something went wrong');
        expect(result.isLoading).to.be.false;
      });

      it('should clear error when passed null', function () {
        const state = { ...initialState, error: 'Previous error' };
        const result = reducer(state, setError(null));
        expect(result.error).to.be.null;
      });
    });

    describe('resetState', function () {
      it('should reset to initial state', function () {
        const modifiedState: DocumentQueryState = {
          displayedDocuments: [{ _id: '1' }],
          currentPage: 5,
          itemsPerPage: 50,
          isLoading: false,
          totalCountInCollection: 100,
          hasReceivedCount: true,
          error: 'Some error',
          errors: {
            getDocuments: 'doc error',
            getTotalCount: 'count error',
          },
        };
        const result = reducer(modifiedState, resetState());
        expect(result).to.deep.equal(initialState);
      });
    });

    describe('startRefresh', function () {
      it('should set loading true, reset page to 1, and clear error', function () {
        const state: DocumentQueryState = {
          ...initialState,
          currentPage: 5,
          isLoading: false,
          error: 'Some error',
        };
        const result = reducer(state, startRefresh());
        expect(result.isLoading).to.be.true;
        expect(result.currentPage).to.equal(1);
        expect(result.error).to.be.null;
      });
    });
  });

  describe('Selectors', function () {
    describe('Basic selectors', function () {
      it('selectDisplayedDocuments should return displayed documents', function () {
        const docs = [{ _id: '1' }, { _id: '2' }];
        const state = createState({ displayedDocuments: docs });
        expect(selectDisplayedDocuments(state)).to.deep.equal(docs);
      });

      it('selectCurrentPage should return current page', function () {
        const state = createState({ currentPage: 3 });
        expect(selectCurrentPage(state)).to.equal(3);
      });

      it('selectItemsPerPage should return items per page', function () {
        const state = createState({ itemsPerPage: 25 });
        expect(selectItemsPerPage(state)).to.equal(25);
      });

      it('selectIsLoading should return loading state', function () {
        expect(selectIsLoading(createState({ isLoading: true }))).to.be.true;
        expect(selectIsLoading(createState({ isLoading: false }))).to.be.false;
      });

      it('selectTotalCountInCollection should return total count', function () {
        expect(
          selectTotalCountInCollection(
            createState({ totalCountInCollection: 50 }),
          ),
        ).to.equal(50);
        expect(
          selectTotalCountInCollection(
            createState({ totalCountInCollection: null }),
          ),
        ).to.be.null;
      });

      it('selectHasReceivedCount should return has received count flag', function () {
        expect(selectHasReceivedCount(createState({ hasReceivedCount: true })))
          .to.be.true;
        expect(selectHasReceivedCount(createState({ hasReceivedCount: false })))
          .to.be.false;
      });

      it('selectError should return error', function () {
        expect(selectError(createState({ error: 'Test error' }))).to.equal(
          'Test error',
        );
        expect(selectError(createState({ error: null }))).to.be.null;
      });
    });

    describe('Derived selectors', function () {
      describe('selectIsCountAvailable', function () {
        it('should return true when total count is set', function () {
          const state = createState({ totalCountInCollection: 100 });
          expect(selectIsCountAvailable(state)).to.be.true;
        });

        it('should return false when total count is null', function () {
          const state = createState({ totalCountInCollection: null });
          expect(selectIsCountAvailable(state)).to.be.false;
        });
      });

      describe('selectTotalDocuments', function () {
        it('should return total count when available', function () {
          const state = createState({
            totalCountInCollection: 100,
            displayedDocuments: [{ _id: '1' }],
          });
          expect(selectTotalDocuments(state)).to.equal(100);
        });

        it('should return displayed documents length when count is null', function () {
          const docs = [{ _id: '1' }, { _id: '2' }, { _id: '3' }];
          const state = createState({
            totalCountInCollection: null,
            displayedDocuments: docs,
          });
          expect(selectTotalDocuments(state)).to.equal(3);
        });
      });

      describe('selectTotalPages', function () {
        it('should calculate total pages correctly', function () {
          const state = createState({
            totalCountInCollection: 55,
            itemsPerPage: 10,
          });
          expect(selectTotalPages(state)).to.equal(6);
        });

        it('should return at least 1 page', function () {
          const state = createState({
            totalCountInCollection: 0,
            itemsPerPage: 10,
          });
          expect(selectTotalPages(state)).to.equal(1);
        });

        it('should handle exact page boundaries', function () {
          const state = createState({
            totalCountInCollection: 50,
            itemsPerPage: 10,
          });
          expect(selectTotalPages(state)).to.equal(5);
        });
      });

      describe('selectStartItem', function () {
        it('should return 0 when no documents', function () {
          const state = createState({
            totalCountInCollection: 0,
            displayedDocuments: [],
            currentPage: 1,
            itemsPerPage: 10,
          });
          expect(selectStartItem(state)).to.equal(0);
        });

        it('should calculate start item for first page', function () {
          const state = createState({
            totalCountInCollection: 50,
            currentPage: 1,
            itemsPerPage: 10,
          });
          expect(selectStartItem(state)).to.equal(1);
        });

        it('should calculate start item for subsequent pages', function () {
          const state = createState({
            totalCountInCollection: 50,
            currentPage: 3,
            itemsPerPage: 10,
          });
          expect(selectStartItem(state)).to.equal(21);
        });
      });

      describe('selectEndItem', function () {
        it('should calculate end item for full page', function () {
          const state = createState({
            totalCountInCollection: 50,
            currentPage: 1,
            itemsPerPage: 10,
          });
          expect(selectEndItem(state)).to.equal(10);
        });

        it('should calculate end item for partial last page', function () {
          const state = createState({
            totalCountInCollection: 55,
            currentPage: 6,
            itemsPerPage: 10,
          });
          expect(selectEndItem(state)).to.equal(55);
        });

        it('should handle middle pages', function () {
          const state = createState({
            totalCountInCollection: 100,
            currentPage: 5,
            itemsPerPage: 10,
          });
          expect(selectEndItem(state)).to.equal(50);
        });
      });
    });
  });
});
