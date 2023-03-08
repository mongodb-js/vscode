import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import type { FileDirectory } from '../../../../ai-code/constants';
import { MAX_INPUT_FILES } from '../../../../ai-code/constants';
import type { PromptState } from './prompt';
import { sendMessageToExtensionAndWaitForResponse } from '../extension-app-msg';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';
import type {
  CodebaseLoadedMessage,
  QuestionResponseMessage,
  SuggestionsLoadedMessage,
} from '../../extension-app-message-constants';

// Use the chatbot for responses or regular gpt individual api requests.
const useChatbot = true;

const requestCancelledErrorMessage = 'Request cancelled';

type CodebaseStatus =
  | 'initial'
  | 'loading'
  | 'loaded'
  | 'generating-suggestions'
  | 'suggested';

export interface CodebaseState {
  directory: string | null;
  currentOpId: string | null;
  githubLink: string | null; // git@github.com:Anemy/test-project-for-ai-code.git or https https://github.com/Anemy/test-project-for-ai-code.git
  useGithubLink: boolean;
  status: CodebaseStatus;
  fileStructure: null | FileDirectory;
  workingDirectory: string | null;
  errorMessage: string | null;
  questionPrompt: string | null;
  questionResponse: string | null;

  diffChanges: string | null; // TODO: not a string.
  descriptionOfChanges: string | null;
}

// const eventListeners = {};

type LoadCodebaseResult = {
  fileStructure: FileDirectory;
  workingDirectory: string;
};
export const loadCodebase = createAsyncThunk<
  LoadCodebaseResult,
  undefined,
  {
    state: {
      codebase: CodebaseState;
    };
  }
>('codebase/load', async (payload, thunkAPI) => {
  // loadCodebase
  // thunkAPI.
  // const {
  //   codebase: { githubLink: rawGithubLink, directory, useGithubLink },
  // } = thunkAPI.getState() as {
  //   codebase: CodebaseState;
  // };

  const thisCurrentOp = uuidv4();
  thunkAPI.dispatch(setCurrentOpId(thisCurrentOp));

  // if ((useGithubLink && !rawGithubLink) || (!useGithubLink && !directory)) {
  //   return thunkAPI.rejectWithValue(
  //     'Please either choose a directory or enter a github link.'
  //   );
  // }

  // Add .git if missing.
  // const githubLink = (rawGithubLink || '').endsWith('.git')
  //   ? rawGithubLink
  //   : `${rawGithubLink}.git`;

  const { fileCount, fileStructure, workingDirectory } =
    await sendMessageToExtensionAndWaitForResponse<CodebaseLoadedMessage>({
      command: MESSAGE_TYPES.LOAD_CODEBASE,
      id: uuidv4(),
      // githubLink: githubLink || '',
      // useGithubLink,
    });

  const {
    codebase: { currentOpId },
  } = thunkAPI.getState() as {
    codebase: CodebaseState;
  };
  if (currentOpId !== thisCurrentOp) {
    return thunkAPI.rejectWithValue(requestCancelledErrorMessage);
  }

  // TODO: Check that the resulting file structure is manageable by the ai.
  if (fileCount > MAX_INPUT_FILES) {
    throw new Error(
      `Too many input files passed, current max is ${MAX_INPUT_FILES} files, ${fileCount} found.`
    );
  }

  return {
    fileStructure,
    workingDirectory,
  };
});

type AskQuestionResult = {
  text: string;
  // TODO: Allow code snippets, actions, etc.
};

export const askQuestion = createAsyncThunk<
  AskQuestionResult,
  undefined,
  {
    state: {
      codebase: CodebaseState;
    };
  }
>('codebase/askQuestion', async (payload, thunkAPI) => {
  const {
    codebase: { questionPrompt },
  } = thunkAPI.getState() as {
    codebase: CodebaseState;
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
    });

  const {
    codebase: { currentOpId },
  } = thunkAPI.getState() as {
    codebase: CodebaseState;
  };
  if (currentOpId !== thisCurrentOp) {
    return thunkAPI.rejectWithValue(requestCancelledErrorMessage);
  }

  return {
    text,
  };
});

type SuggestionsResult = {
  diffChanges: string;
  descriptionOfChanges: string;
};
export const generateSuggestions = createAsyncThunk<
  SuggestionsResult,
  undefined,
  {
    state: {
      codebase: CodebaseState;
      prompt: PromptState;
    };
  }
>('codebase/generate-suggestions', async (payload, thunkAPI) => {
  const {
    prompt: { promptText },
    codebase: { fileStructure, workingDirectory },
  } = thunkAPI.getState();

  console.log('Generating suggestions base on prompt...');

  if (!promptText) {
    return thunkAPI.rejectWithValue('Please enter a prompt to drive changes.');
  }

  const thisCurrentOp = uuidv4();
  thunkAPI.dispatch(setCurrentOpId(thisCurrentOp));

  const { diffResult, descriptionOfChanges } =
    await sendMessageToExtensionAndWaitForResponse<SuggestionsLoadedMessage>({
      command: MESSAGE_TYPES.LOAD_SUGGESTIONS,
      id: uuidv4(),

      fileStructure: fileStructure as FileDirectory,
      promptText,
      useChatbot,
      workingDirectory: workingDirectory as string,
    });

  const {
    codebase: { currentOpId },
  } = thunkAPI.getState() as {
    codebase: CodebaseState;
  };
  if (currentOpId !== thisCurrentOp) {
    return thunkAPI.rejectWithValue(requestCancelledErrorMessage);
  }

  return {
    diffChanges: diffResult,
    descriptionOfChanges,
  };
});

function createInitialState(): CodebaseState {
  return {
    directory: null,
    githubLink: null,
    useGithubLink: false,
    workingDirectory: null,
    status: 'initial',
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

export const codebaseSlice = createSlice({
  name: 'codebase',
  initialState,
  reducers: {
    setDirectory: (state, action: PayloadAction<string>) => {
      state.directory = action.payload;
    },
    setGithubLink: (state, action: PayloadAction<string>) => {
      state.githubLink = action.payload;
    },
    setQuestionPrompt: (state, action: PayloadAction<string>) => {
      state.questionPrompt = action.payload;
    },
    setUseGithubLink: (state, action: PayloadAction<boolean>) => {
      state.useGithubLink = action.payload;
    },
    setCurrentOpId: (state, action: PayloadAction<string | null>) => {
      state.currentOpId = action.payload;
    },
    setStatus: (state, action: PayloadAction<CodebaseStatus>) => {
      state.status = action.payload;
      // (Hacky implementation) release any current op.
      state.currentOpId = null;
    },
  },
  extraReducers: {
    [loadCodebase.pending.type]: (state) => {
      state.status = 'loading';
      state.fileStructure = null;
      state.workingDirectory = null;
      state.errorMessage = null;
    },
    [loadCodebase.fulfilled.type]: (
      state,
      action: PayloadAction<LoadCodebaseResult>
    ) => {
      state.status = 'loaded';
      state.currentOpId = null;
      state.fileStructure = action.payload.fileStructure;
      state.workingDirectory = action.payload.workingDirectory;
      state.errorMessage = null;
    },
    [loadCodebase.rejected.type]: (state, action: PayloadAction<string>) => {
      // Do nothing if request cancelled.
      if (action.payload === requestCancelledErrorMessage) {
        return;
      }

      state.status = 'initial';
      state.fileStructure = null;
      state.workingDirectory = null;
      state.errorMessage = action.payload
        ? action.payload
        : (action as any)?.error?.message;
    },

    [generateSuggestions.pending.type]: (state) => {
      state.status = 'generating-suggestions';
      state.diffChanges = null;
      state.descriptionOfChanges = null;
      state.errorMessage = null;
    },
    [generateSuggestions.fulfilled.type]: (
      state,
      action: PayloadAction<SuggestionsResult>
    ) => {
      state.status = 'suggested';
      state.currentOpId = null;
      state.diffChanges = action.payload.diffChanges;
      state.descriptionOfChanges = action.payload.descriptionOfChanges;
      state.errorMessage = null;
    },
    [generateSuggestions.rejected.type]: (
      state,
      action: PayloadAction<string>
    ) => {
      // Do nothing if request cancelled.
      if (action.payload === requestCancelledErrorMessage) {
        return;
      }

      state.status = 'loaded';
      state.diffChanges = null;
      state.descriptionOfChanges = null;
      state.errorMessage = action.payload
        ? action.payload
        : (action as any)?.error?.message;
    },

    [askQuestion.pending.type]: (state) => {
      state.status = 'generating-suggestions';
      state.questionResponse = null;
      state.errorMessage = null;
    },
    [askQuestion.fulfilled.type]: (state, action: PayloadAction<string>) => {
      state.status = 'suggested';
      state.currentOpId = null;
      state.questionResponse = action.payload;
      state.errorMessage = null;
    },
    [askQuestion.rejected.type]: (state, action: PayloadAction<string>) => {
      // Do nothing if request cancelled.
      if (action.payload === requestCancelledErrorMessage) {
        return;
      }

      state.status = 'loaded';
      state.questionResponse = null;
      state.errorMessage = action.payload
        ? action.payload
        : (action as any)?.error?.message;
    },
  },
});

// Action creators for each case reducer function.
export const {
  setDirectory,
  setGithubLink,
  setQuestionPrompt,
  setUseGithubLink,
  setStatus,
  setCurrentOpId,
} = codebaseSlice.actions;

const codebaseReducer = codebaseSlice.reducer;
export { codebaseReducer };
