export type OutputItem = {
  type: string | null;
  content: string;
};

export type ExecuteAllResult = {
  outputLines: OutputItem[] | undefined;
  result: OutputItem | undefined;
};
