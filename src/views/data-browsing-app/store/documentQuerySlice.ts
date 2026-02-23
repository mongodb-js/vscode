import type { Draft, PayloadAction } from '@reduxjs/toolkit';
import { createSlice, current } from '@reduxjs/toolkit';
import {
  sendGetDocuments,
  sendGetTotalCount,
  sendCancelRequest,
} from '../vscode-api';
import {
  SORT_VALUE_MAP,
  type TokenColors,
  type MonacoBaseTheme,
  type DocumentSort,
  type SortValueKey,
} from '../extension-app-message-constants';
import { ServiceProvider } from '@mongosh/service-provider-core';

export interface PreviewDocument {
  [key: string]: unknown;
}

export interface SortOption {
  label: string;
  value: string;
  sort: DocumentSort | null;
}

const SORT_LABELS: Record<string, string> = Object.assign(Object.create(null), {
  default: 'Default',
  _id_asc: '_id: 1',
  _id_desc: '_id: -1',
});

export const SORT_OPTIONS: SortOption[] = Object.entries(SORT_VALUE_MAP).map(
  ([key, sort]) => ({
    label: SORT_LABELS[key],
    value: key,
    sort: sort ?? null,
  }),
);

export type ErrorType = 'getDocuments' | 'getTotalCount';

export interface ErrorsState {
  getDocuments: string | null;
  getTotalCount: string | null;
}

// for now we won't do much with this. It really just separates "cursor queries"
// from basic queries where we browse a collection
export type ServiceProviderQuery = {
  options:
    | {
        method: 'find';
        // database, collection, filter, findOptions, dbOptions
        args: Parameters<ServiceProvider['find']>;
      }
    | {
        method: 'aggregate';
        // database, collection, pipeline, aggregateOptions, dbOptions
        args: Parameters<ServiceProvider['aggregate']>;
      }
    | {
        method: 'aggregateDb';
        // database, pipeline, aggregateOptions, dbOptions
        args: Parameters<ServiceProvider['aggregateDb']>;
      }
    | {
        method: 'runCursorCommand';
        // database, spec, runCursorCommandOptions, dbOptions
        args: Parameters<ServiceProvider['runCursorCommand']>;
      };
  chains: {
    method: 'string';
    args: any[];
  }[];
};

export type DocumentQueryState = {
  displayedDocuments: PreviewDocument[];
  currentPage: number;
  totalCountForQuery: number | null;

  itemsPerPage: number;

  // for now we will only display controls like bulk delete, sort and the total
  // count for basic queries (ie. query === null)
  sort: SortOption | null;
  query: ServiceProviderQuery | null;

  // TODO: these are derived values, why are we storing them?
  totalPages: number | null;
  startItem: number;
  endItem: number;
  // until we get totalCountForQuery this is just displayedDocuments.length
  totalDocuments: number | null;

  isLoading: boolean;
  hasReceivedCount: boolean;
  errors: ErrorsState;
  themeColors: TokenColors | null;
  themeKind: MonacoBaseTheme;
};

const DEFAULT_ITEMS_PER_PAGE = 10;

export const isBasicQuery = (
  state: any,
): state is DocumentQueryState & { query: null } => {
  return state.query === null;
};

const recalculatePaginationValues = (
  state: Draft<DocumentQueryState>,
): void => {
  if (isBasicQuery(state)) {
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
  } else {
    // for non-basic queries we won't have pagination controls beyond
    // next/previous page and amount per page
    state.totalDocuments = null;
    state.totalPages = null;
    state.startItem = (state.currentPage - 1) * state.itemsPerPage + 1;
    state.endItem = Math.min(
      state.currentPage * state.itemsPerPage,
      state.startItem + state.displayedDocuments.length - 1,
    );
  }
};

export const getInitialSort = (): SortOption | null => {
  if (
    typeof window !== 'undefined' &&
    window.MDB_DATA_BROWSING_OPTIONS?.defaultSortOrder
  ) {
    const key = window.MDB_DATA_BROWSING_OPTIONS
      .defaultSortOrder as SortValueKey;
    return SORT_OPTIONS.find((opt) => opt.value === key) ?? null;
  }
  return null;
};

export const getInitialQuery = (): ServiceProviderQuery | null => {
  if (
    typeof window !== 'undefined' &&
    window.MDB_DATA_BROWSING_OPTIONS?.query
  ) {
    const queryString = window.MDB_DATA_BROWSING_OPTIONS.query;
    return JSON.parse(queryString) as ServiceProviderQuery;
  }
  return null;
};

export const initialState: DocumentQueryState = {
  displayedDocuments: [],
  currentPage: 1,
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE,

  sort: getInitialSort(),
  query: getInitialQuery(),
  isLoading: true,
  totalCountForQuery: null,
  hasReceivedCount: false,
  errors: {
    getDocuments: null,
    getTotalCount: null,
  },
  totalDocuments: null,
  totalPages: null,
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
      if (state.totalPages === null || state.currentPage < state.totalPages) {
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
      if (
        state.totalPages !== null &&
        state.currentPage > state.totalPages &&
        state.totalPages > 0
      ) {
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
      state.totalCountForQuery = action.payload;
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
