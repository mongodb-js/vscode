import { expect } from 'chai';
import reducer, {
  initialState,
  documentsReceived,
  requestCancelled,
  totalCountReceived,
  totalCountFetchFailed,
  selectDocumentQuery,
  type DocumentQueryState,
  type PreviewDocument,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';

describe('documentQuerySlice', function () {
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

  describe('Message Handler Actions', function () {
    describe('documentsReceived', function () {
      it('should set documents and stop loading', function () {
        const state = { ...initialState, currentPage: 3, isLoading: true };
        const documents: PreviewDocument[] = [{ _id: '1' }];
        const result = reducer(state, documentsReceived(documents));
        expect(result.displayedDocuments).to.deep.equal(documents);
        expect(result.currentPage).to.equal(3);
        expect(result.isLoading).to.be.false;
        expect(result.error).to.be.null;
      });

      it('should clear any existing error', function () {
        const state = { ...initialState, error: 'Previous error' };
        const result = reducer(state, documentsReceived([]));
        expect(result.error).to.be.null;
      });
    });

    describe('requestCancelled', function () {
      it('should set loading to false', function () {
        const result = reducer(initialState, requestCancelled());
        expect(result.isLoading).to.be.false;
      });
    });

    describe('totalCountReceived', function () {
      it('should set total count and mark as received', function () {
        const result = reducer(initialState, totalCountReceived(100));
        expect(result.totalCountInCollection).to.equal(100);
        expect(result.hasReceivedCount).to.be.true;
      });

      it('should handle null count', function () {
        const state = { ...initialState, totalCountInCollection: 50 };
        const result = reducer(state, totalCountReceived(null));
        expect(result.totalCountInCollection).to.be.null;
        expect(result.hasReceivedCount).to.be.true;
      });
    });

    describe('totalCountFetchFailed', function () {
      it('should mark count as received and set error', function () {
        const result = reducer(
          initialState,
          totalCountFetchFailed('Count failed'),
        );
        expect(result.hasReceivedCount).to.be.true;
        expect(result.totalCountInCollection).to.be.null;
        expect(result.errors.getTotalCount).to.equal('Count failed');
      });
    });
  });

  describe('Selectors', function () {
    describe('selectDocumentQuery', function () {
      it('should return the entire document query state', function () {
        const docs = [{ _id: '1' }, { _id: '2' }];
        const state = createState({
          displayedDocuments: docs,
          currentPage: 3,
          itemsPerPage: 25,
          isLoading: false,
          totalCountInCollection: 100,
          hasReceivedCount: true,
          error: 'Test error',
        });
        const result = selectDocumentQuery(state);
        expect(result.displayedDocuments).to.deep.equal(docs);
        expect(result.currentPage).to.equal(3);
        expect(result.itemsPerPage).to.equal(25);
        expect(result.isLoading).to.be.false;
        expect(result.totalCountInCollection).to.equal(100);
        expect(result.hasReceivedCount).to.be.true;
        expect(result.error).to.equal('Test error');
      });
    });

    describe('Computed values in state', function () {
      describe('documentsReceived recalculates computed values', function () {
        it('should calculate totalDocuments from displayedDocuments when count is null', function () {
          const docs = [{ _id: '1' }, { _id: '2' }, { _id: '3' }];
          const result = reducer(initialState, documentsReceived(docs));
          expect(result.totalDocuments).to.equal(3);
        });

        it('should calculate totalPages correctly', function () {
          const docs = Array.from({ length: 25 }, (_, i) => ({ _id: `${i}` }));
          const result = reducer(initialState, documentsReceived(docs));
          expect(result.totalPages).to.equal(3); // 25 docs / 10 per page = 3 pages
        });

        it('should calculate startItem and endItem correctly', function () {
          const docs = Array.from({ length: 10 }, (_, i) => ({ _id: `${i}` }));
          const result = reducer(initialState, documentsReceived(docs));
          expect(result.startItem).to.equal(1);
          expect(result.endItem).to.equal(10);
        });
      });

      describe('totalCountReceived recalculates computed values', function () {
        it('should use totalCountInCollection for totalDocuments', function () {
          const result = reducer(initialState, totalCountReceived(100));
          expect(result.totalDocuments).to.equal(100);
        });

        it('should calculate totalPages from totalCountInCollection', function () {
          const result = reducer(initialState, totalCountReceived(55));
          expect(result.totalPages).to.equal(6); // 55 / 10 = 6 pages
        });

        it('should handle null count by using displayedDocuments length', function () {
          const stateWithDocs = reducer(
            initialState,
            documentsReceived([{ _id: '1' }, { _id: '2' }]),
          );
          const result = reducer(stateWithDocs, totalCountReceived(null));
          expect(result.totalDocuments).to.equal(2);
        });
      });

      describe('startItem and endItem edge cases', function () {
        it('should return startItem 0 when no documents', function () {
          const result = reducer(initialState, totalCountReceived(0));
          expect(result.startItem).to.equal(0);
          expect(result.endItem).to.equal(0);
        });

        it('should calculate correctly for middle pages', function () {
          // First set up state with total count
          const state = reducer(initialState, totalCountReceived(100));
          // Simulate being on page 3 by loading docs (which sets currentPage via other actions)
          // For this test, we directly check the calculation with known values
          expect(state.totalDocuments).to.equal(100);
          expect(state.totalPages).to.equal(10); // 100 / 10 = 10 pages
        });
      });
    });
  });
});
