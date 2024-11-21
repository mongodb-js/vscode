import type * as vscode from 'vscode';
import type { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';

export type PlaygroundRunResult = {
  content: any;
  language?: string;
  namespace?: string;
  type?: string;
};

export type ExportToLanguageResult = {
  prompt: string;
  content: string;
  language: string;
  includeDriverSyntax: boolean;
};

export function isExportToLanguageResult(
  result: PlaygroundRunResult | ExportToLanguageResult
): result is ExportToLanguageResult {
  return (result as ExportToLanguageResult).prompt !== undefined;
}

export type ShellEvaluateResult = {
  result: PlaygroundRunResult | undefined;
} | null;

export type PlaygroundEvaluateParams = {
  codeToEvaluate: string;
  connectionId: string;
  filePath?: string;
};

export interface PlaygroundTextAndSelection {
  textFromEditor: string;
  selection: vscode.Selection;
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
