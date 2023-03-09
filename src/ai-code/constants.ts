export const MAX_INPUT_FILES = 5;
export const MAX_FILE_LENGTH_CHARACTERS = 10000;

type FileName = string;

export type FileDirectory = {
  [name: string]: FileDirectory | FileName;
};

export type ConversationHistory = {
  role: 'user' | 'assistant' | 'system';
  content: string;
}[];
