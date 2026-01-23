import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import {
  sendGetDocuments,
  sendGetTotalCount,
  sendCancelRequest,
} from '../vscode-api';

export interface PreviewDocument {
  [key: string]: unknown;
}

export type ErrorType = 'getDocuments' | 'getTotalCount';

export interface ErrorsState {
  getDocuments: string | null;
  getTotalCount: string | null;
}

export interface DocumentQueryState {
  displayedDocuments: PreviewDocument[];
  currentPage: number;
  itemsPerPage: number;
  isLoading: boolean;
  totalCountInCollection: number | null;
  hasReceivedCount: boolean;
  error: string | null;
  errors: ErrorsState;
}

const DEFAULT_ITEMS_PER_PAGE = 10;

export const initialState: DocumentQueryState = {
  displayedDocuments: [],
  currentPage: 1,
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
  isLoading: true,
  totalCountInCollection: null,
  hasReceivedCount: false,
  error: null,
  errors: {
    getDocuments: null,
    getTotalCount: null,
  },
};

const calculateTotalPages = (state: DocumentQueryState): number => {
  const totalDocuments =
    state.totalCountInCollection !== null
      ? state.totalCountInCollection
      : state.displayedDocuments.length;
  return Math.max(1, Math.ceil(totalDocuments / state.itemsPerPage));
};

const documentQuerySlice = createSlice({
  name: 'documentQuery',
  initialState,
  reducers: {
    // ========================================
    // UI Actions (dispatched from preview-page.tsx)
    // ========================================
    refreshDocuments: (state) => {
      state.isLoading = true;
      state.currentPage = 1;
      state.error = null;
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      sendGetDocuments(0, state.itemsPerPage);
      sendGetTotalCount();
    },
    fetchInitialDocuments: (state) => {
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      sendGetDocuments(0, state.itemsPerPage);
      sendGetTotalCount();
    },
    goToPreviousPage: (state) => {
      if (state.currentPage > 1) {
        const newPage = state.currentPage - 1;
        const skip = (newPage - 1) * state.itemsPerPage;
        state.currentPage = newPage;
        state.isLoading = true;
        state.error = null;
        state.errors.getDocuments = null;
        sendGetDocuments(skip, state.itemsPerPage);
      }
    },
    goToNextPage: (state) => {
      const totalPages = calculateTotalPages(state);
      if (state.currentPage < totalPages) {
        const newPage = state.currentPage + 1;
        const skip = (newPage - 1) * state.itemsPerPage;
        state.currentPage = newPage;
        state.isLoading = true;
        state.error = null;
        state.errors.getDocuments = null;
        sendGetDocuments(skip, state.itemsPerPage);
      }
    },
    changeItemsPerPage: (state, action: PayloadAction<number>) => {
      const newItemsPerPage = action.payload;
      state.itemsPerPage = newItemsPerPage;
      state.currentPage = 1;
      state.isLoading = true;
      state.error = null;
      state.errors.getDocuments = null;
      sendGetDocuments(0, newItemsPerPage);
    },
    cancelRequest: (state) => {
      state.isLoading = false;
      sendCancelRequest();
    },
    adjustCurrentPage: (state) => {
      const totalPages = calculateTotalPages(state);
      if (state.currentPage > totalPages && totalPages > 0) {
        state.currentPage = totalPages;
      }
    },

    // ========================================
    // Message Handler Actions (dispatched from messageHandler.ts)
    // ========================================
    handleDocumentsLoaded: (state, action: PayloadAction<PreviewDocument[]>) => {
      state.displayedDocuments = action.payload;
      state.isLoading = false;
      state.error = null;
      state.errors.getDocuments = null;
    },
    handleDocumentError: (state, action: PayloadAction<string>) => {
      state.errors.getDocuments = action.payload;
      state.isLoading = false;
    },
    handleRequestCancelled: (state) => {
      state.isLoading = false;
    },
    handleTotalCountReceived: (state, action: PayloadAction<number | null>) => {
      state.totalCountInCollection = action.payload;
      state.hasReceivedCount = true;
      state.errors.getTotalCount = null;
    },
    handleTotalCountError: (state, action: PayloadAction<string>) => {
      state.hasReceivedCount = true;
      state.errors.getTotalCount = action.payload;
    },
  },
});

// UI Actions - dispatched from preview-page.tsx
export const {
  refreshDocuments,
  fetchInitialDocuments,
  goToPreviousPage,
  goToNextPage,
  changeItemsPerPage,
  cancelRequest,
  adjustCurrentPage,
  // Message Handler Actions - dispatched from messageHandler.ts
  handleDocumentsLoaded,
  handleDocumentError,
  handleRequestCancelled,
  handleTotalCountReceived,
  handleTotalCountError,
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

export const selectErrors = (state: StateWithDocumentQuery): ErrorsState =>
  state.documentQuery.errors;

export const selectGetDocumentsError = (
  state: StateWithDocumentQuery,
): string | null => state.documentQuery.errors.getDocuments;

export const selectGetTotalCountError = (
  state: StateWithDocumentQuery,
): string | null => state.documentQuery.errors.getTotalCount;

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
