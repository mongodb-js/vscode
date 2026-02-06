import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import {
  sendGetDocuments,
  sendGetTotalCount,
  sendCancelRequest,
} from '../vscode-api';
import type { TokenColors } from '../extension-app-message-constants';

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
  errors: ErrorsState;
  totalDocuments: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  themeColors: TokenColors | null;
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
  errors: {
    getDocuments: null,
    getTotalCount: null,
  },
  totalDocuments: 0,
  totalPages: 1,
  startItem: 0,
  endItem: 0,
  themeColors: null,
};

const documentQuerySlice = createSlice({
  name: 'documentQuery',
  initialState,
  reducers: {
    documentsRefreshRequested: (state) => {
      state.isLoading = true;
      state.currentPage = 1;
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      recalculatePaginationValues(state);
      sendGetDocuments(0, state.itemsPerPage);
      sendGetTotalCount();
    },
    initialDocumentsFetchRequested: (state) => {
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      sendGetDocuments(0, state.itemsPerPage);
      sendGetTotalCount();
    },
    previousPageRequested: (state) => {
      if (state.currentPage > 1) {
        const newPage = state.currentPage - 1;
        const skip = (newPage - 1) * state.itemsPerPage;
        state.currentPage = newPage;
        state.isLoading = true;
        state.errors.getDocuments = null;
        recalculatePaginationValues(state);
        sendGetDocuments(skip, state.itemsPerPage);
      }
    },
    nextPageRequested: (state) => {
      if (state.currentPage < state.totalPages) {
        const newPage = state.currentPage + 1;
        const skip = (newPage - 1) * state.itemsPerPage;
        state.currentPage = newPage;
        state.isLoading = true;
        state.errors.getDocuments = null;
        recalculatePaginationValues(state);
        sendGetDocuments(skip, state.itemsPerPage);
      }
    },
    itemsPerPageChanged: (state, action: PayloadAction<number>) => {
      const newItemsPerPage = action.payload;
      state.itemsPerPage = newItemsPerPage;
      state.currentPage = 1;
      state.isLoading = true;
      state.errors.getDocuments = null;
      recalculatePaginationValues(state);
      sendGetDocuments(0, newItemsPerPage);
    },
    requestCancellationRequested: (state) => {
      state.isLoading = false;
      sendCancelRequest();
    },
    currentPageAdjusted: (state) => {
      if (state.currentPage > state.totalPages && state.totalPages > 0) {
        state.currentPage = state.totalPages;
        recalculatePaginationValues(state);
      }
    },

    // ========================================
    // Extension message response actions (dispatched from messageHandler.ts)
    // ========================================
    documentsReceived: (state, action: PayloadAction<PreviewDocument[]>) => {
      state.displayedDocuments = action.payload;
      state.isLoading = false;
      state.errors.getDocuments = null;
      recalculatePaginationValues(state);
    },
    documentsFetchFailed: (state, action: PayloadAction<string>) => {
      state.errors.getDocuments = action.payload;
      state.isLoading = false;
    },
    requestCancelled: (state) => {
      state.isLoading = false;
    },
    totalCountReceived: (state, action: PayloadAction<number | null>) => {
      state.totalCountInCollection = action.payload;
      state.hasReceivedCount = true;
      state.errors.getTotalCount = null;
      recalculatePaginationValues(state);
    },
    totalCountFetchFailed: (state, action: PayloadAction<string>) => {
      state.hasReceivedCount = true;
      state.errors.getTotalCount = action.payload;
    },
    themeColorsReceived: (
      state,
      action: PayloadAction<TokenColors | null>,
    ) => {
      state.themeColors = action.payload;
    },
  },
});

export const {
  documentsRefreshRequested,
  initialDocumentsFetchRequested,
  previousPageRequested,
  nextPageRequested,
  itemsPerPageChanged,
  requestCancellationRequested,
  currentPageAdjusted,
  documentsReceived,
  documentsFetchFailed,
  requestCancelled,
  totalCountReceived,
  totalCountFetchFailed,
  themeColorsReceived,
} = documentQuerySlice.actions;

export type StateWithDocumentQuery = { documentQuery: DocumentQueryState };

export const selectDocumentQuery = (
  state: StateWithDocumentQuery,
): DocumentQueryState => state.documentQuery;

export default documentQuerySlice.reducer;
