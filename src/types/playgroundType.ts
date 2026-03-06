import type * as vscode from 'vscode';
import type { NodeDriverServiceProvider } from '@mongosh/service-provider-node-driver';

import type { DocumentViewAndEditFormat } from '../editors/types';
import type { CursorConstructionOptionsWithChains } from '@mongosh/shell-api';

// This is the "raw" playground result before it gets wrapped
export type PlaygroundRunResult = {
  content: any;
  language?: string;
  namespace?: string;
  type?: string;
  constructionOptions?: CursorConstructionOptionsWithChains;
};

// This is a type-asserted more specifiv version of PlaygroundRunResult where constructionOptions is guaranteed to be present
export type PlaygroundRunCursorResult = PlaygroundRunResult & {
  constructionOptions: CursorConstructionOptionsWithChains;
};

// Same as PlaygroundRunResult, but constructionOptions is stringified so we can send it across a process boundary (ie. back from the worker)
export type SerializedPlaygroundRunResult = {
  content: any;
  language?: string;
  namespace?: string;
  type?: string;
  constructionOptions?: string;
};

// This is just the result (ie. without any possible error) that will be sent back from the worker before it gets serialized
export type ShellEvaluateResult = {
  result: PlaygroundRunResult | undefined;
} | null;

// This is what the worker sends back to its parent before it gets serialised
export type PlaygroundExecutionResult = {
  data: ShellEvaluateResult;
  error?: Error;
};

// This is what the worker sends back to its parent after it gets serialised. We
// immediately parse it back to PlaygroundExecutionResult in mongoDBService.ts.
export type SerializedPlaygroundExecutionResult = {
  data: {
    result: SerializedPlaygroundRunResult | null;
  };
  error?: Error;
};

export type ExportToLanguageResult = {
  prompt: string;
  content: string;
  language: string;
  includeDriverSyntax: boolean;
};

export function isExportToLanguageResult(
  result: PlaygroundRunResult | ExportToLanguageResult,
): result is ExportToLanguageResult {
  return (result as ExportToLanguageResult).prompt !== undefined;
}

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
