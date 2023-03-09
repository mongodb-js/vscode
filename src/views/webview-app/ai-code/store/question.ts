import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'bson';

import type {
  ConversationHistory,
  FileDirectory,
} from '../../../../ai-code/constants';
import { sendMessageToExtensionAndWaitForResponse } from '../extension-app-msg';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';
import type { QuestionResponseMessage } from '../../extension-app-message-constants';

const requestCancelledErrorMessage = 'Request cancelled';

// Currently unused
type QuestionStatus = 'initial' | 'typing' | 'asking' | 'asked' | '????';

type Answer = {
  text: string;
  questionText: string;
  id: string;
  conversationId: string;
  history: ConversationHistory;
};

export interface QuestionState {
  includeSelectionInQuestion: boolean;
  currentOpId: string | null;
  status: QuestionStatus;
  fileStructure: null | FileDirectory;
  errorMessage: string | null;
  questionPrompt: string | null;
  isAskingQuestion: string | null;

  diffChanges: string | null; // TODO: not a string.
  descriptionOfChanges: string | null;
  answers: Answer[];
}

type AskQuestionResult = {
  text: string;
  questionText: string;
  conversationId: string;
  history: ConversationHistory;
  // TODO: Allow code snippets, actions, etc.
};

export const askQuestion = createAsyncThunk<
  AskQuestionResult,
  {
    history: ConversationHistory;
    newMessage?: {
      codeSelection?: string;
      includeSelectionInQuestion: boolean;
    };
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

  // conversation_id needs to be Object ID (it generates one if not passed).
  // Useful for follow up qs.
  const conversationId = new ObjectId().toString(); // `rhys-test-${Math.floor(Math.random() * 10000)}`, // uuidv4(),

  const includeSelectionInQuestion = !!(
    // TODO: keep all state in extension not in the redux on the webview.
    (
      payload.newMessage?.includeSelectionInQuestion &&
      payload.newMessage?.codeSelection &&
      payload.newMessage?.codeSelection.trim().length > 0
    )
  );

  const { text, questionText } =
    await sendMessageToExtensionAndWaitForResponse<QuestionResponseMessage>({
      command: MESSAGE_TYPES.ASK_QUESTION,
      id: uuidv4(),
      history: payload.history,
      newMessage: payload.newMessage
        ? {
            text: questionPrompt,
            codeSelection: includeSelectionInQuestion
              ? payload.newMessage?.codeSelection
              : undefined,
          }
        : undefined,
      conversationId,
    });

  const {
    question: { currentOpId },
  } = thunkAPI.getState() as {
    question: QuestionState;
  };
  if (currentOpId !== thisCurrentOp) {
    return thunkAPI.rejectWithValue(requestCancelledErrorMessage);
  }

  const newHistory: ConversationHistory = [
    ...payload.history,
    {
      role: 'assistant',
      content: text,
    },
  ];

  return {
    questionText,
    text,
    conversationId,
    history: newHistory,
  };
});

function createInitialState(): QuestionState {
  return {
    includeSelectionInQuestion: true,
    status: 'initial',
    isAskingQuestion: null,
    fileStructure: null,
    errorMessage: null,
    currentOpId: null,
    questionPrompt: null,
    answers: [],

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
    clearAnswers: (state) => {
      state.isAskingQuestion = null;
      state.currentOpId = null;
      state.errorMessage = null;
      state.answers = [];
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
      state.isAskingQuestion = state.questionPrompt; // TODO: This doesn't work with out of date prompt
      // is bug
      state.errorMessage = null;
    },
    [askQuestion.fulfilled.type]: (
      state,
      action: PayloadAction<AskQuestionResult>
    ) => {
      // state.status = 'suggested';
      state.currentOpId = null;
      state.answers = [
        ...state.answers,
        {
          text: action.payload.text,
          questionText: action.payload.questionText,
          id: uuidv4(),
          // id: uuidv4(),
          conversationId: action.payload.conversationId,
          history: action.payload.history,
        },
      ];
      state.isAskingQuestion = null;
      state.errorMessage = null;
    },
    [askQuestion.rejected.type]: (state, action: PayloadAction<string>) => {
      // Do nothing if request cancelled.
      if (action.payload === requestCancelledErrorMessage) {
        return;
      }

      // state.status = 'loaded';
      state.isAskingQuestion = null;
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
  clearAnswers,
  setIncludeSelectionInQuestion,
} = questionSlice.actions;

const questionReducer = questionSlice.reducer;
export { questionReducer };
