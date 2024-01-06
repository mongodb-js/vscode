export type ClearCompletionsCache = {
  [key in
    | 'databases'
    | 'collections'
    | 'fields'
    | 'streamProcessors']?: boolean;
};
