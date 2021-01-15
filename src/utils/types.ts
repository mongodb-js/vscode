import { EJSON } from 'bson';
import { DocumentSource } from './documentSource';

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
  source: DocumentSource;
  line: number;
  documentId: EJSON.SerializableTypes;
  namespace: string;
  connectionId: string | null;
};

export type CloudInfoResult = {
  isAws: boolean;
  isGcp: boolean;
  isAzure: boolean;
};
