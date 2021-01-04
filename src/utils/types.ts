export type OutputItem = {
  namespace: string | null;
  type: string | null;
  content: any;
};

export type ExecuteAllResult = {
  outputLines: OutputItem[] | undefined;
  result: OutputItem | undefined;
};

export type DocCodeLensesInfo = {
  line: number;
  documentId: string;
  namespace: string;
}[];
