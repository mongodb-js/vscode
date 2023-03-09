import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import type { FileDirectory } from '../../../../ai-code/constants';
import { sendMessageToExtensionAndWaitForResponse } from '../extension-app-msg';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';
import type { QuestionResponseMessage } from '../../extension-app-message-constants';

const requestCancelledErrorMessage = 'Request cancelled';

// Currently unused
type QuestionStatus = 'initial' | 'typing' | 'asking' | 'asked' | '????';

export interface QuestionState {
  includeSelectionInQuestion: boolean;
  currentOpId: string | null;
  status: QuestionStatus;
  fileStructure: null | FileDirectory;
  errorMessage: string | null;
  questionPrompt: string | null;
  questionResponse: string | null;
  isAskingQuestion: boolean;

  diffChanges: string | null; // TODO: not a string.
  descriptionOfChanges: string | null;
}

type AskQuestionResult = {
  text: string;
  // TODO: Allow code snippets, actions, etc.
};

export const askQuestion = createAsyncThunk<
  AskQuestionResult,
  {
    includeSelectionInQuestion: boolean;
    codeSelection: string;
  },
  {
    state: {
      question: QuestionState;
    };
  }
>('question/askQuestion', async (payload, thunkAPI) => {
  const {
    question: { questionPrompt },
  } = thunkAPI.getState() as {
    question: QuestionState;
  };

  const thisCurrentOp = uuidv4();
  thunkAPI.dispatch(setCurrentOpId(thisCurrentOp));

  if (!questionPrompt) {
    return thunkAPI.rejectWithValue('Please type a question to ask.');
  }

  const { text } =
    await sendMessageToExtensionAndWaitForResponse<QuestionResponseMessage>({
      command: MESSAGE_TYPES.ASK_QUESTION,
      id: uuidv4(),
      text: questionPrompt,
      includeSelectionInQuestion:
        payload.includeSelectionInQuestion &&
        payload.codeSelection.trim().length > 0,
      codeSelection: payload.codeSelection,
    });

  const {
    question: { currentOpId },
  } = thunkAPI.getState() as {
    question: QuestionState;
  };
  if (currentOpId !== thisCurrentOp) {
    return thunkAPI.rejectWithValue(requestCancelledErrorMessage);
  }

  return {
    text,
  };
});

function createInitialState(): QuestionState {
  return {
    includeSelectionInQuestion: true,
    status: 'initial',
    isAskingQuestion: false,
    fileStructure: null,
    errorMessage: null,
    currentOpId: null,
    questionPrompt: null,
    questionResponse: null,

    diffChanges: null,
    descriptionOfChanges: null,
  };
}
const initialState = createInitialState();

export const questionSlice = createSlice({
  name: 'codebase',
  initialState,
  reducers: {
    setIncludeSelectionInQuestion: (state, action: PayloadAction<boolean>) => {
      state.includeSelectionInQuestion = action.payload;
    },
    setQuestionPrompt: (state, action: PayloadAction<string>) => {
      state.questionPrompt = action.payload;
    },
    setCurrentOpId: (state, action: PayloadAction<string | null>) => {
      state.currentOpId = action.payload;
    },
    setStatus: (state, action: PayloadAction<QuestionStatus>) => {
      state.status = action.payload;
      // (Hacky implementation) release any current op.
      state.currentOpId = null;
    },
  },
  extraReducers: {
    [askQuestion.pending.type]: (state) => {
      // state.status = 'generating-suggestions';
      state.questionResponse = null;
      state.isAskingQuestion = true;
      state.errorMessage = null;
    },
    [askQuestion.fulfilled.type]: (
      state,
      action: PayloadAction<AskQuestionResult>
    ) => {
      // state.status = 'suggested';
      state.currentOpId = null;
      state.questionResponse = action.payload.text;
      state.isAskingQuestion = false;
      state.errorMessage = null;
    },
    [askQuestion.rejected.type]: (state, action: PayloadAction<string>) => {
      // Do nothing if request cancelled.
      if (action.payload === requestCancelledErrorMessage) {
        return;
      }

      // state.status = 'loaded';
      state.questionResponse = null;
      state.isAskingQuestion = false;
      state.errorMessage = action.payload
        ? action.payload
        : (action as any)?.error?.message;
    },
  },
});

// Action creators for each case reducer function.
export const {
  setQuestionPrompt,
  setCurrentOpId,
  setIncludeSelectionInQuestion,
} = questionSlice.actions;

const questionReducer = questionSlice.reducer;
export { questionReducer };
