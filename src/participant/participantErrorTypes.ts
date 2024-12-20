export enum ParticipantErrorTypes {
  CHAT_MODEL_OFF_TOPIC = 'Chat Model Off Topic',
  INVALID_PROMPT = 'Invalid Prompt',
  FILTERED = 'Filtered by Responsible AI Service',
  OTHER = 'Other',
  DOCS_CHATBOT_API = 'Docs Chatbot API Issue',
}

export enum ExportToPlaygroundFailure {
  CANCELLED = 'cancelled',
  MODEL_INPUT = 'modelInput',
  STREAM_CHAT_RESPONSE = 'streamChatResponseWithExportToLanguage',
}
