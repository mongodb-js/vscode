import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export interface PreviewDocument {
  [key: string]: unknown;
}

export interface DocumentQueryState {
  displayedDocuments: PreviewDocument[];
  currentPage: number;
  itemsPerPage: number;
  isLoading: boolean;
  totalCountInCollection: number | null;
  hasReceivedCount: boolean;
  error: string | null;
}

const DEFAULT_ITEMS_PER_PAGE = 10;

const initialState: DocumentQueryState = {
  displayedDocuments: [],
  currentPage: 1,
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
  isLoading: true,
  totalCountInCollection: null,
  hasReceivedCount: false,
  error: null,
};

const documentQuerySlice = createSlice({
  name: 'documentQuery',
  initialState,
  reducers: {
    setDisplayedDocuments: (
      state,
      action: PayloadAction<PreviewDocument[]>,
    ) => {
      state.displayedDocuments = action.payload;
    },
    loadDocuments: (state, action: PayloadAction<PreviewDocument[]>) => {
      state.displayedDocuments = action.payload;
      state.currentPage = 1;
      state.isLoading = false;
      state.error = null;
    },
    loadPage: (state, action: PayloadAction<PreviewDocument[]>) => {
      state.displayedDocuments = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setItemsPerPage: (state, action: PayloadAction<number>) => {
      state.itemsPerPage = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    startLoading: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    stopLoading: (state) => {
      state.isLoading = false;
    },
    setTotalCountInCollection: (
      state,
      action: PayloadAction<number | null>,
    ) => {
      state.totalCountInCollection = action.payload;
      state.hasReceivedCount = true;
    },
    markCountReceived: (state) => {
      state.hasReceivedCount = true;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    resetState: () => initialState,
    startRefresh: (state) => {
      state.isLoading = true;
      state.currentPage = 1;
      state.error = null;
    },
  },
});

export const {
  setDisplayedDocuments,
  loadDocuments,
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
} = documentQuerySlice.actions;

type StateWithDocumentQuery = { documentQuery: DocumentQueryState };

export const selectDisplayedDocuments = (
  state: StateWithDocumentQuery,
): PreviewDocument[] => state.documentQuery.displayedDocuments;

export const selectCurrentPage = (state: StateWithDocumentQuery): number =>
  state.documentQuery.currentPage;

export const selectItemsPerPage = (state: StateWithDocumentQuery): number =>
  state.documentQuery.itemsPerPage;

export const selectIsLoading = (state: StateWithDocumentQuery): boolean =>
  state.documentQuery.isLoading;

export const selectTotalCountInCollection = (
  state: StateWithDocumentQuery,
): number | null => state.documentQuery.totalCountInCollection;

export const selectHasReceivedCount = (
  state: StateWithDocumentQuery,
): boolean => state.documentQuery.hasReceivedCount;

export const selectError = (state: StateWithDocumentQuery): string | null =>
  state.documentQuery.error;

// Derived selectors
export const selectIsCountAvailable = (
  state: StateWithDocumentQuery,
): boolean => state.documentQuery.totalCountInCollection !== null;

export const selectTotalDocuments = (state: StateWithDocumentQuery): number => {
  const { totalCountInCollection, displayedDocuments } = state.documentQuery;
  return totalCountInCollection !== null
    ? totalCountInCollection
    : displayedDocuments.length;
};

export const selectTotalPages = (state: StateWithDocumentQuery): number => {
  const totalDocuments = selectTotalDocuments(state);
  const itemsPerPage = state.documentQuery.itemsPerPage;
  return Math.max(1, Math.ceil(totalDocuments / itemsPerPage));
};

export const selectStartItem = (state: StateWithDocumentQuery): number => {
  const totalDocuments = selectTotalDocuments(state);
  const { currentPage, itemsPerPage } = state.documentQuery;
  return totalDocuments === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
};

export const selectEndItem = (state: StateWithDocumentQuery): number => {
  const totalDocuments = selectTotalDocuments(state);
  const { currentPage, itemsPerPage } = state.documentQuery;
  return Math.min(currentPage * itemsPerPage, totalDocuments);
};

export default documentQuerySlice.reducer;
