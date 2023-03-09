import { configureStore } from '@reduxjs/toolkit';

import { codebaseReducer } from './codebase';
import { promptReducer } from './prompt';
import { questionReducer } from './question';

// TODO: Serialize and deserialize on dismount.
export const store = configureStore({
  reducer: {
    question: questionReducer,
    codebase: codebaseReducer,
    prompt: promptReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
