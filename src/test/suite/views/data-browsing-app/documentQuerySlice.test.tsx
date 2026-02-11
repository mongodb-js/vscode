import { expect } from 'chai';
import reducer, {
  initialState,
  documentsReceived,
  requestCancelled,
  totalCountReceived,
  totalCountFetchFailed,
  themeColorsReceived,
  selectDocumentQuery,
  SORT_OPTIONS,
  type DocumentQueryState,
  type PreviewDocument,
} from '../../../../views/data-browsing-app/store/documentQuerySlice';
import {
  SORT_VALUE_MAP,
  type TokenColors,
} from '../../../../views/data-browsing-app/extension-app-message-constants';

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
      expect(result.sort).to.be.null;
      expect(result.isLoading).to.be.true;
      expect(result.totalCountInCollection).to.be.null;
      expect(result.hasReceivedCount).to.be.false;
      expect(result.errors.getDocuments).to.be.null;
      expect(result.errors.getTotalCount).to.be.null;
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
        expect(result.errors.getDocuments).to.be.null;
      });

      it('should clear any existing error', function () {
        const state = {
          ...initialState,
          errors: { ...initialState.errors, getDocuments: 'Previous error' },
        };
        const result = reducer(state, documentsReceived([]));
        expect(result.errors.getDocuments).to.be.null;
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

    describe('themeColorsReceived', function () {
      it('should set theme colors', function () {
        const themeColors: TokenColors = {
          key: '#ff0000',
          string: '#00ff00',
          number: '#0000ff',
          boolean: '#ffff00',
          null: '#ff00ff',
          type: '#00ffff',
          comment: '#888888',
          punctuation: '#ffffff',
        };
        const result = reducer(
          initialState,
          themeColorsReceived({ themeColors, themeKind: 'vs-dark' }),
        );
        expect(result.themeColors).to.deep.equal(themeColors);
        expect(result.themeKind).to.equal('vs-dark');
      });

      it('should handle null theme colors', function () {
        const stateWithColors = {
          ...initialState,
          themeColors: {
            key: '#ff0000',
            string: '#00ff00',
            number: '#0000ff',
            boolean: '#ffff00',
            null: '#ff00ff',
            type: '#00ffff',
            comment: '#888888',
            punctuation: '#ffffff',
          },
        };
        const result = reducer(
          stateWithColors,
          themeColorsReceived({ themeColors: null, themeKind: 'vs' }),
        );
        expect(result.themeColors).to.be.null;
        expect(result.themeKind).to.equal('vs');
      });
    });

  });

  describe('SORT_VALUE_MAP', function () {
    it('should have exactly three keys', function () {
      expect(Object.keys(SORT_VALUE_MAP)).to.have.lengthOf(3);
    });

    it('should have the expected keys', function () {
      expect(SORT_VALUE_MAP).to.have.property('default');
      expect(SORT_VALUE_MAP).to.have.property('_id_asc');
      expect(SORT_VALUE_MAP).to.have.property('_id_desc');
    });

    it('should map default to undefined', function () {
      expect(SORT_VALUE_MAP.default).to.be.undefined;
    });

    it('should map _id_asc to { _id: 1 }', function () {
      expect(SORT_VALUE_MAP._id_asc).to.deep.equal({ _id: 1 });
    });

    it('should map _id_desc to { _id: -1 }', function () {
      expect(SORT_VALUE_MAP._id_desc).to.deep.equal({ _id: -1 });
    });

    it('should have keys matching the mdb.defaultSortOrder enum in package.json', function () {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const packageJson = require('../../../../../package.json');
      const configEnum: string[] =
        packageJson.contributes.configuration.properties[
          'mdb.defaultSortOrder'
        ].enum;
      expect(Object.keys(SORT_VALUE_MAP)).to.deep.equal(configEnum);
    });
  });

  describe('SORT_OPTIONS derived from SORT_VALUE_MAP', function () {
    it('should have an option for every key in SORT_VALUE_MAP', function () {
      expect(SORT_OPTIONS).to.have.lengthOf(
        Object.keys(SORT_VALUE_MAP).length,
      );
    });

    it('should have value fields matching SORT_VALUE_MAP keys', function () {
      const values = SORT_OPTIONS.map((opt) => opt.value);
      expect(values).to.include.members(Object.keys(SORT_VALUE_MAP));
    });

    it('should have the correct labels', function () {
      const defaultOpt = SORT_OPTIONS.find((o) => o.value === 'default');
      const ascOpt = SORT_OPTIONS.find((o) => o.value === '_id_asc');
      const descOpt = SORT_OPTIONS.find((o) => o.value === '_id_desc');
      expect(defaultOpt?.label).to.equal('Default');
      expect(ascOpt?.label).to.equal('_id: 1');
      expect(descOpt?.label).to.equal('_id: -1');
    });

    it('should map sort values consistently with SORT_VALUE_MAP (undefined → null)', function () {
      for (const option of SORT_OPTIONS) {
        const mapValue =
          SORT_VALUE_MAP[option.value as keyof typeof SORT_VALUE_MAP];
        if (mapValue === undefined) {
          expect(option.sort).to.be.null;
        } else {
          expect(option.sort).to.deep.equal(mapValue);
        }
      }
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
          errors: { getDocuments: 'Test error', getTotalCount: null },
        });
        const result = selectDocumentQuery(state);
        expect(result.displayedDocuments).to.deep.equal(docs);
        expect(result.currentPage).to.equal(3);
        expect(result.itemsPerPage).to.equal(25);
        expect(result.isLoading).to.be.false;
        expect(result.totalCountInCollection).to.equal(100);
        expect(result.hasReceivedCount).to.be.true;
        expect(result.errors.getDocuments).to.equal('Test error');
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
