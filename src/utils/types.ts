import { EJSON } from 'bson';
import { CompletionItem } from 'vscode-languageserver';
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

export type NodeOptions = {
  appname?: string;
  auth?: {
    user: string;
    password: string;
  };
  authSource?: string;
  authMechanism?: string;
  sslCA?: string;
  sslKey?: string;
  sslCert?: string;
  sslPass?: string;
};

export type ShellCompletionItem = {
  [symbol: string]: CompletionItem[] | []
};

export type CollectionItem = {
  name: string;
  type?: string;
  options?: object,
  info?: { readOnly: boolean; uuid: object[] },
  idIndex?: { v: number; key: object[]; name: string; ns: string }
};
