import {
  createConnection,
  TextDocuments,
  TextDocumentsConfiguration,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  RequestType
} from 'vscode-languageserver';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documentsConfig = {
  create(uri: string, languageId: string, version: number, content: string) {
    // connection.console.log(
    //   `documentsConfig.create: ${JSON.stringify({
    //     uri,
    //     languageId,
    //     version,
    //     content
    //   })}`
    // );
  },
  update(document: any, changes: any[], version: number) {
    // connection.console.log(
    //   `documentsConfig.update: ${JSON.stringify({
    //     document,
    //     changes,
    //     version
    //   })}`
    // );
  }
} as TextDocumentsConfiguration<any>;

const documents: TextDocuments<any> = new TextDocuments(documentsConfig);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  return {
    capabilities: {
      textDocumentSync: (documents as any).syncKind,
      // Tell the client that the server supports code completion
      completionProvider: {
        resolveProvider: true
      }
      // documentFormattingProvider: true,
      // documentRangeFormattingProvider: true,
      // codeLensProvider: {
      //   resolveProvider: true
      // }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  // if (hasWorkspaceFolderCapability) {
  //   connection.workspace.onDidChangeWorkspaceFolders((_event) => {
  //     connection.console.log('Workspace folder change event received.');
  //   });
  // }
});

// The example settings
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    globalSettings = <ExampleSettings>(
      (change.settings.languageServerExample || defaultSettings)
    );
  }

  // Revalidate all open text documents
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'mongodbLanguageServer'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
  // connection.console.log(`documents.onDidClose: ${JSON.stringify(e)}`);
  documentSettings.delete(e.document.uri);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri);

  // The validator creates diagnostics for all uppercase words length 2 and more
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  // eslint-disable-next-line no-cond-assign
  while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
    problems++;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length)
      },
      message: `${m[0]} is all uppercase.`,
      source: 'ex'
    };
    if (hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range)
          },
          message: 'Spelling matters'
        },
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range)
          },
          message: 'Particularly for names'
        }
      ];
    }
    diagnostics.push(diagnostic);
  }

  // Send the computed diagnostics to VSCode.
  // connection.console.log(
  //   `sendDiagnostics: ${JSON.stringify({ uri: textDocument.uri, diagnostics })}`
  // );
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

  // const notification = new NotificationType<string>('mongodbNotification');
  connection.sendNotification(
    'mongodbNotification',
    'Enjoy these diagnostics!'
  );
}

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // connection.console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(change)}`
  // );

  if (change.document) {
    validateTextDocument(change.document);
  }
});

connection.onRequest(new RequestType('textDocument/codeLens'), (event) => {
  // connection.console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(event)}`
  // );
  // const text = documents.get(event.textDocument.uri).getText();
  // const parsed = parseDocument(text);
  // return parsed;
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  // connection.console.log(
  //   `We received an file change event: ${JSON.stringify(_change)}`
  // );
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    // connection.console.log(
    //   `onCompletion: ${JSON.stringify({ _textDocumentPosition })}`
    // );
    return [
      {
        label: 'TypeScript',
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: 'JavaScript',
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // connection.console.log(`onCompletionResolve: ${JSON.stringify(item)}`);
    if (item.data === 1) {
      item.detail = 'TypeScript details';
      item.documentation = 'TypeScript documentation';
    } else if (item.data === 2) {
      item.detail = 'JavaScript details';
      item.documentation = 'JavaScript documentation';
    }
    return item;
  }
);

/**
 * Execute the entire playground script.
 */
connection.onRequest('executeAll', (event) => {
  // connection.console.log(`executeAll: ${JSON.stringify(event)}`);
  return '';
});

/**
 * Execute a single block of code in the playground.
 */
connection.onRequest('executeRange', (event) => {
  // connection.console.log(`executeRange: ${JSON.stringify(event)}`);
  return '';
});

connection.onRequest('textDocument/rangeFormatting', (event) => {
  // connection.console.log(
  //   `textDocument/rangeFormatting: ${JSON.stringify({ event })}`
  // );
  const text = documents.get(event.textDocument.uri).getText(event.range);

  return text;
});

connection.onRequest('textDocument/formatting', (event) => {
  const document = documents.get(event.textDocument.uri);
  const text = document.getText();
  const range = {
    start: { line: 0, character: 0 },
    end: { line: document.lineCount, character: 0 }
  };
  // connection.console.log(
  //   `textDocument/formatting: ${JSON.stringify({
  //     text,
  //     options: event.options,
  //     range
  //   })}`
  // );
  return text;
});

connection.onDidOpenTextDocument((params) => {
  // A text document got opened in VSCode.
  // params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
  // params.textDocument.text the initial full content of the document.
  // connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
  // The content of a text document did change in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  // connection.console.log(
  //   `${params.textDocument.uri} changed: ${JSON.stringify(
  //     params.contentChanges
  //   )}`
  // );
});
connection.onDidCloseTextDocument((params) => {
  // A text document got closed in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // connection.console.log(`${params.textDocument.uri} closed.`);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
