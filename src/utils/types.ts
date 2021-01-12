import { EJSON } from 'bson';

export type OutputItem = {
  namespace: string | null;
  type: string | null;
  content: any;
};

export type ExecuteAllResult = {
  outputLines: OutputItem[] | undefined;
  result: OutputItem | undefined;
};

export type ResultCodeLensInfo = {
  line: number;
  documentId: EJSON.SerializableTypes;
  namespace: string;
  connectionId: string | null;
};
