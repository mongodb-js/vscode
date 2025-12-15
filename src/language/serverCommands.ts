export const ServerCommand = {
  activeConnectionChanged: 'ACTIVE_CONNECTION_CHANGED',
  executeCodeFromPlayground: 'EXECUTE_CODE_FROM_PLAYGROUND',
  executeRangeFromPlayground: 'EXECUTE_RANGE_FROM_PLAYGROUND',
  showErrorMessage: 'SHOW_ERROR_MESSAGE',
  showInfoMessage: 'SHOW_INFO_MESSAGE',
  getExportToLanguageMode: 'GET_EXPORT_TO_LANGUAGE_MODE',
  updateCurrentSessionFields: 'UPDATE_CURRENT_SESSION_FIELDS',
  clearCachedCompletions: 'CLEAR_CACHED_COMPLETIONS',
  mongodbServiceCreated: 'MONGODB_SERVICE_CREATED',
  initializeMongodbService: 'INITIALIZE_MONGODB_SERVICE',
  codeExecutionResult: 'CODE_EXECUTION_RESULT',
  showConsoleOutput: 'SHOW_CONSOLE_OUTPUT',
} as const;

export type ServerCommands = (typeof ServerCommand)[keyof typeof ServerCommand];

export type PlaygroundRunParameters = {
  codeToEvaluate: string;
};
