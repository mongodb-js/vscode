import type * as vscode from 'vscode';
import type { CliServiceProvider } from '@mongosh/service-provider-server';

export type OutputItem = {
  namespace: string | null;
  type: string | null;
  content: any;
  language: string | null;
};

export type PlaygroundResult = OutputItem | undefined;

export type ShellEvaluateResult = {
  result: PlaygroundResult;
} | null;

export type PlaygroundEvaluateParams = {
  codeToEvaluate: string;
  connectionId: string;
  filePath?: string;
};

export interface ExportToLanguageAddons {
  textFromEditor?: string;
  selectedText?: string;
  selection?: vscode.Selection;
  importStatements: boolean;
  driverSyntax: boolean;
  language: string;
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
  RUST = 'rust',
  PHP = 'php',
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
