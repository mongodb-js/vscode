import type * as vscode from 'vscode';
import type { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';

import type { DocumentViewAndEditFormat } from '../editors/types';

export type PlaygroundRunResult = {
  namespace?: string;
  type?: string;
  content: any;
  language?: string;
};

export type ExportToLanguageResult = {
  content: string;
  codeToTranspile: string;
  language: string;
  includeDriverSyntax: boolean;
};

export function isExportToLanguageResult(
  result: PlaygroundRunResult | ExportToLanguageResult
): result is ExportToLanguageResult {
  return (result as ExportToLanguageResult).codeToTranspile !== undefined;
}

export type ShellEvaluateResult = {
  result: PlaygroundRunResult | undefined;
} | null;

export type PlaygroundEvaluateParams = {
  codeToEvaluate: string;
  connectionId: string;
  expectedFormat: DocumentViewAndEditFormat;
  filePath?: string;
};

export interface PlaygroundTextAndSelection {
  textFromEditor: string;
  selection: vscode.Selection;
}

export enum ExportToLanguage {
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  JAVASCRIPT = 'javascript',
  RUBY = 'ruby',
  GO = 'go',
  RUST = 'rust',
  PHP = 'php',
}

// MongoClientOptions is the second argument of NodeDriverServiceProvider.connect(connectionStr, options).
export type MongoClientOptions = NonNullable<
  Parameters<(typeof NodeDriverServiceProvider)['connect']>[1]
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
