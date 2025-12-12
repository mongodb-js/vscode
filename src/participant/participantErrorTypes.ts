export const PARTICIPANT_ERROR_TYPES = {
  CHAT_MODEL_OFF_TOPIC: 'Chat Model Off Topic',
  INVALID_PROMPT: 'Invalid Prompt',
  FILTERED: 'Filtered by Responsible AI Service',
  OTHER: 'Other',
  DOCS_CHATBOT_API: 'Docs Chatbot API Issue',
} as const;

export type ParticipantErrorType =
  (typeof PARTICIPANT_ERROR_TYPES)[keyof typeof PARTICIPANT_ERROR_TYPES];

export type ExportToPlaygroundError =
  | 'cancelled'
  | 'modelInput'
  | 'streamChatResponseWithExportToLanguage';
