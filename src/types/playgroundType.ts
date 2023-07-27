import * as vscode from 'vscode';
import { CliServiceProvider } from '@mongosh/service-provider-server';

export type OutputItem = {
  namespace: string | null;
  type: string | null;
  content: any;
  language: string | null;
};

export type PlaygroundDebug = OutputItem[] | undefined;

export type PlaygroundResult = OutputItem | undefined;

export type ShellEvaluateResult =
  | {
      outputLines: PlaygroundDebug;
      result: PlaygroundResult;
    }
  | undefined;

export type PlaygroundEvaluateParams = {
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
  mode?: ExportToLanguageMode;
}

export interface PlaygroundTextAndSelection {
  textFromEditor: string;
  selection: vscode.Selection;
}

export enum ExportToLanguages {
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  JAVASCRIPT = 'javascript',
  RUBY = 'ruby',
  GO = 'go',
}

export enum ExportToLanguageMode {
  QUERY = 'QUERY',
  AGGREGATION = 'AGGREGATION',
  OTHER = 'OTHER',
}

export interface ExportToLanguageNamespace {
  databaseName: string | null;
  collectionName: string | null;
}

// MongoClientOptions is the second argument of CliServiceProvider.connect(connectionStr, options).
export type MongoClientOptions = NonNullable<
  Parameters<(typeof CliServiceProvider)['connect']>[1]
>;

export interface WorkerEvaluate {
  codeToEvaluate: string;
  connectionString: string;
  connectionOptions: MongoClientOptions;
}

export interface ThisDiagnosticFix {
  documentUri: vscode.Uri;
  range: any;
  fix: string;
}

export interface AllDiagnosticFixes {
  documentUri: vscode.Uri;
  diagnostics: {
    range: any;
    fix: string;
  }[];
}
