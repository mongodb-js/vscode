import { configureStore } from '@reduxjs/toolkit';
import documentQueryReducer from './documentQuerySlice';

export const store = configureStore({
  reducer: {
    documentQuery: documentQueryReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
