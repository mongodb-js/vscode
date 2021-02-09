export type OutputItem = {
  namespace: string | null;
  type: string | null;
  content: any;
};

export type PlaygroundDebug = OutputItem[] | undefined;

export type PlaygroundResult = OutputItem | undefined;

export type ShellExecuteAllResult = {
  outputLines: PlaygroundDebug;
  result: PlaygroundResult
} | undefined;

export type PlaygroundExecuteParameters = {
  codeToEvaluate: string;
  connectionId: string;
};
