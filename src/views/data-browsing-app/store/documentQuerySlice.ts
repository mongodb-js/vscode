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
  totalDocuments: number;
  totalPages: number;
  startItem: number;
  endItem: number;
}

const DEFAULT_ITEMS_PER_PAGE = 10;

const recalculatePaginationValues = (state: DocumentQueryState): void => {
  state.totalDocuments =
    state.totalCountInCollection !== null
      ? state.totalCountInCollection
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
};

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
  totalDocuments: 0,
  totalPages: 1,
  startItem: 0,
  endItem: 0,
};

const documentQuerySlice = createSlice({
  name: 'documentQuery',
  initialState,
  reducers: {
    refreshDocuments: (state) => {
      state.isLoading = true;
      state.currentPage = 1;
      state.error = null;
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      recalculatePaginationValues(state);
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
        recalculatePaginationValues(state);
        sendGetDocuments(skip, state.itemsPerPage);
      }
    },
    goToNextPage: (state) => {
      if (state.currentPage < state.totalPages) {
        const newPage = state.currentPage + 1;
        const skip = (newPage - 1) * state.itemsPerPage;
        state.currentPage = newPage;
        state.isLoading = true;
        state.error = null;
        state.errors.getDocuments = null;
        recalculatePaginationValues(state);
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
      recalculatePaginationValues(state);
      sendGetDocuments(0, newItemsPerPage);
    },
    cancelRequest: (state) => {
      state.isLoading = false;
      sendCancelRequest();
    },
    adjustCurrentPage: (state) => {
      if (state.currentPage > state.totalPages && state.totalPages > 0) {
        state.currentPage = state.totalPages;
        recalculatePaginationValues(state);
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
      recalculatePaginationValues(state);
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
      recalculatePaginationValues(state);
    },
    handleTotalCountError: (state, action: PayloadAction<string>) => {
      state.hasReceivedCount = true;
      state.errors.getTotalCount = action.payload;
    },
  },
});

export const {
  refreshDocuments,
  fetchInitialDocuments,
  goToPreviousPage,
  goToNextPage,
  changeItemsPerPage,
  cancelRequest,
  adjustCurrentPage,
  handleDocumentsLoaded,
  handleDocumentError,
  handleRequestCancelled,
  handleTotalCountReceived,
  handleTotalCountError,
} = documentQuerySlice.actions;

export type StateWithDocumentQuery = { documentQuery: DocumentQueryState };

export const selectDocumentQuery = (
  state: StateWithDocumentQuery,
): DocumentQueryState => state.documentQuery;

export default documentQuerySlice.reducer;
