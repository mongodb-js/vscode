import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface PromptState {
  promptText: string | null;
}

const initialState: PromptState = {
  promptText: null,
};

export const promptSlice = createSlice({
  name: 'prompt',
  initialState,
  reducers: {
    setPrompt: (state, action: PayloadAction<string>) => {
      state.promptText = action.payload;
    },
  },
});

export const { setPrompt } = promptSlice.actions;

const promptReducer = promptSlice.reducer;
export { promptReducer };
