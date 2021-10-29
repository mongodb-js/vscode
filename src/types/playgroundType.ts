import * as vscode from 'vscode';

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

export interface ExportToLanguageAddons {
  textFromEditor?: string;
  selectedText?: string;
  selection?: vscode.Selection;
  importStatements: boolean;
  driverSyntax: boolean;
  builders: boolean;
  language: string;
  mode?: string;
}

export interface PlaygroundTextAndSelection {
  textFromEditor: string;
  selection: vscode.Selection;
}

export enum ExportToLanguages {
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  JAVASCRIPT = 'javascript'
}

export enum ExportToLanguageMode {
  QUERY = 'QUERY',
  AGGREGATION = 'AGGREGATION',
  OTHER = 'OTHER'
}

export interface ExportToLanguageNamespace {
  databaseName: string | null;
  collectionName: string | null;
}
