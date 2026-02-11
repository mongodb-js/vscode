import { configureStore, type EnhancedStore } from '@reduxjs/toolkit';
import documentQueryReducer, {
  type DocumentQueryState,
} from './documentQuerySlice';

export type RootState = {
  documentQuery: DocumentQueryState;
};

export const createStore = (
  preloadedState?: Partial<RootState>,
): EnhancedStore<RootState> =>
  configureStore({
    reducer: {
      documentQuery: documentQueryReducer,
    },
    preloadedState: preloadedState as RootState | undefined,
  });

export const store = createStore();

export type AppDispatch = typeof store.dispatch;
