export const ParticipantErrorType = {
  chatModelOffTopic: 'Chat Model Off Topic',
  invalidPrompt: 'Invalid Prompt',
  filtered: 'Filtered by Responsible AI Service',
  other: 'Other',
  docsChatbotApi: 'Docs Chatbot API Issue',
} as const;

export type ParticipantErrorType =
  (typeof ParticipantErrorType)[keyof typeof ParticipantErrorType];

export type ExportToPlaygroundError =
  | 'cancelled'
  | 'modelInput'
  | 'streamChatResponseWithExportToLanguage';
