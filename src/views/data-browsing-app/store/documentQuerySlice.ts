import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, current } from '@reduxjs/toolkit';
import {
  sendGetDocuments,
  sendGetTotalCount,
  sendCancelRequest,
} from '../vscode-api';
import type {
  TokenColors,
  MonacoBaseTheme,
  DocumentSort,
} from '../extension-app-message-constants';

export interface PreviewDocument {
  [key: string]: unknown;
}

export interface SortOption {
  label: string;
  value: string;
  sort: DocumentSort | null;
}

export const SORT_OPTIONS: SortOption[] = [
  { label: 'Default', value: 'default', sort: null },
  { label: '_id: 1', value: '_id_asc', sort: { _id: 1 } },
  { label: '_id: -1', value: '_id_desc', sort: { _id: -1 } },
];

export type ErrorType = 'getDocuments' | 'getTotalCount';

export interface ErrorsState {
  getDocuments: string | null;
  getTotalCount: string | null;
}

export interface DocumentQueryState {
  displayedDocuments: PreviewDocument[];
  currentPage: number;
  itemsPerPage: number;
  sort: SortOption | null;
  isLoading: boolean;
  totalCountInCollection: number | null;
  hasReceivedCount: boolean;
  errors: ErrorsState;
  totalDocuments: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  themeColors: TokenColors | null;
  themeKind: MonacoBaseTheme;
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
  sort: null,
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
  themeKind: 'vs-dark',
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
      const currentState = current(state);
      sendGetDocuments({
        skip: 0,
        limit: currentState.itemsPerPage,
        sort: currentState.sort,
      });
      sendGetTotalCount();
    },
    initialDocumentsFetchRequested: (state) => {
      state.errors.getDocuments = null;
      state.errors.getTotalCount = null;
      const currentState = current(state);
      sendGetDocuments({
        skip: 0,
        limit: currentState.itemsPerPage,
        sort: currentState.sort,
      });
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
        const currentState = current(state);
        sendGetDocuments({
          skip,
          limit: currentState.itemsPerPage,
          sort: currentState.sort,
        });
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
        const currentState = current(state);
        sendGetDocuments({
          skip,
          limit: currentState.itemsPerPage,
          sort: currentState.sort,
        });
      }
    },
    itemsPerPageChanged: (state, action: PayloadAction<number>) => {
      const newItemsPerPage = action.payload;
      state.itemsPerPage = newItemsPerPage;
      state.currentPage = 1;
      state.isLoading = true;
      state.errors.getDocuments = null;
      recalculatePaginationValues(state);
      const currentState = current(state);
      sendGetDocuments({
        skip: 0,
        limit: newItemsPerPage,
        sort: currentState.sort,
      });
    },
    sortChanged: (state, action: PayloadAction<SortOption | null>) => {
      state.sort = action.payload;
      state.currentPage = 1;
      state.isLoading = true;
      state.errors.getDocuments = null;
      recalculatePaginationValues(state);
      const currentState = current(state);
      sendGetDocuments({
        skip: 0,
        limit: currentState.itemsPerPage,
        sort: action.payload,
      });
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
      action: PayloadAction<{
        themeColors: TokenColors | null;
        themeKind: MonacoBaseTheme;
      }>,
    ) => {
      state.themeColors = action.payload.themeColors;
      state.themeKind = action.payload.themeKind;
    },
  },
});

export const {
  documentsRefreshRequested,
  initialDocumentsFetchRequested,
  previousPageRequested,
  nextPageRequested,
  itemsPerPageChanged,
  sortChanged,
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
