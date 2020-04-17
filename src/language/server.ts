import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  RequestType,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Worker as WorkerThreads } from 'worker_threads';

const path = require('path');
const esprima = require('esprima');

let connectionString = 'mongodb://localhost';
let connectionOptions = {};

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

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
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      },
      // Tell the client that the server supports code completion
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.'],
      },
      // documentFormattingProvider: true,
      // documentRangeFormattingProvider: true,
      // codeLensProvider: {
      //   resolveProvider: true
      // }
    },
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
  //     console.log('Workspace folder change event received.');
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
      (change.settings.mongodbLanguageServer || defaultSettings)
    );
  }

  // Revalidate all open text documents
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  documents.all().forEach(validateTextDocument);
});

const getDocumentSettings = (resource: string): Thenable<ExampleSettings> => {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }

  let result = documentSettings.get(resource);

  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'mongodbLanguageServer',
    });
    documentSettings.set(resource, result);
  }

  return result;
};

// Only keep settings for open documents
documents.onDidClose((e) => {
  // console.log(`documents.onDidClose: ${JSON.stringify(e)}`);

  documentSettings.delete(e.document.uri);
});

const validateTextDocument = async (
  textDocument: TextDocument
): Promise<void> => {
  // In this simple example we get the settings for every validate run.
  const settings = await getDocumentSettings(textDocument.uri);

  // The validator creates diagnostics for all uppercase words length 2 and more
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  const diagnostics: Diagnostic[] = [];
  let m: RegExpExecArray | null;
  let problems = 0;

  // eslint-disable-next-line no-cond-assign
  while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
    problems++;

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} is all uppercase.`,
      source: 'ex',
    };

    if (hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: 'Spelling matters',
        },
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: 'Particularly for names',
        },
      ];
    }

    diagnostics.push(diagnostic);
  }

  // Send the computed diagnostics to VSCode.
  // console.log(
  //   `sendDiagnostics: ${JSON.stringify({ uri: textDocument.uri, diagnostics })}`
  // );
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

  // const notification = new NotificationType<string>('showInformationMessage');
  // connection.sendNotification(
  //   'showInformationMessage',
  //   'Enjoy these diagnostics!'
  // );
};

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  // console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(change)}`
  // );

  if (change.document) {
    validateTextDocument(change.document);
  }
});

connection.onRequest(new RequestType('textDocument/codeLens'), (event) => {
  // console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(event)}`
  // );
  // const text = documents.get(event.textDocument.uri).getText();
  // const parsed = parseDocument(text);
  // return parsed;
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  // console.log(
  //   `We received an file change event: ${JSON.stringify(_change)}`
  // );
});

connection.onRequest('connect', (params) => {
  connectionString = params.connectionString;
  connectionOptions = params.connectionOptions ? params.connectionOptions : {};
});

// Check if the current node is an object property and
// get the current value and the collection name
const getObjectProperty = (body, currentPosition) => {
  return body
    .slice(0) // Make a copy of the original array to prevent mutation
    .reduce((accumulate, expressionStatement, i, arr) => {
      switch (expressionStatement.type) {
        case esprima.Syntax.ExpressionStatement:
          if (
            expressionStatement.expression &&
            expressionStatement.expression.type === esprima.Syntax.CallExpression &&
            expressionStatement.expression.arguments &&
            expressionStatement.expression.arguments[0].type === esprima.Syntax.ObjectExpression &&
            expressionStatement.expression.arguments[0].properties &&
            expressionStatement.expression.arguments[0].properties[0].type === esprima.Syntax.Property &&
            expressionStatement.expression.arguments[0].properties[0].key &&
            expressionStatement.expression.arguments[0].properties[0].key.type === esprima.Syntax.Identifier
          ) {
            const objectKey = expressionStatement.expression.arguments[0].properties[0].key;
            const collectionName = expressionStatement.expression.callee.object.property.name;

            if (
              currentPosition.line === objectKey.loc.end.line - 1 &&
              currentPosition.character === objectKey.loc.end.column
            ) {
              accumulate = { objectKey, collectionName: collectionName || 'test' };
              arr.splice(1); // Terminate the reduce function
            }
          }
          break;
      }

      return accumulate;
    }, null);
};

// Request the completion items from `mongosh` based on the current input.
const provideCompletionItems = (
  params: TextDocumentPositionParams
): Promise<any> => {
  return new Promise((resolve) => {
    const CompletionItems: any[] = [];

    // We use textToComplete to get text from the editor till the current character
    // to pass it to `mongosh` parser. We use `mongosh` parser
    // to complete shell API symbols/methods
    const textToComplete = documents.get(params.textDocument.uri)?.getText({
      start: { line: 0, character: 0 },
      end: params.position,
    });

    if (!textToComplete) {
      return resolve(CompletionItems);
    }

    // We use fieldsToComplete to get all text from the editor
    // to pass it to `esprima` parser. We use `esprima` parser
    // to complete fields from the active collection
    const fieldsToComplete = documents.get(params.textDocument.uri)?.getText();

    try {
      const ast = esprima.parseScript(fieldsToComplete, { range: true, loc: true });
      const objectProperty = getObjectProperty(ast.body, params.position);

      if (objectProperty) {
        CompletionItems.push({
          label: objectProperty.collectionName,
          kind: CompletionItemKind.Text,
        });
      }

      // console.log(`'params.position: ${JSON.stringify(params.position)}'`);
      // console.log(`'objectProps: ${JSON.stringify(objectProps)}'`);
    } catch (error) {
      console.log(`'Esprima error: ${error}'`);
    }

    // console.log(`'textToComplete: ${textToComplete}'`);

    const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
      // The workerData parameter sends data to the created worker
      workerData: {
        textToComplete,
        connectionString,
        connectionOptions,
      },
    });

    worker.postMessage('getCompletions');

    // Listen for results from the worker thread
    worker.on('message', ([error, result]) => {
      if (error) {
        connection.sendNotification('showErrorMessage', error.message);
      }

      console.log(`'Result: ${JSON.stringify(result)}'`);
      console.log(`'CompletionItems: ${JSON.stringify(CompletionItems)}'`);

      if (!result || !Array.isArray(result) || !textToComplete || result.length === 0) {
        return resolve(CompletionItems);
      }

      // Convert Completion[] format returned by `mongosh`
      // to CompletionItem[] format required by VSCode
      result = result.map((item) => {
        // The runtime.getCompletions() function returns complitions including the user input.
        // Slice the user input and show only suggested keywords to complete the query.
        const index = item.completion.indexOf(textToComplete);
        const label =
          index === -1
            ? item.completion
            : `${item.completion.slice(0, index)}${item.completion.slice(
              index + textToComplete.length
            )}`;

        return {
          label,
          kind: CompletionItemKind.Text,
        };
      });

      worker.terminate();

      return resolve(result);
    });
  });
};

// This handler provides the list of the completion items.
connection.onCompletion((params: TextDocumentPositionParams) => {
  return provideCompletionItems(params);
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // console.log(`onCompletionResolve: ${JSON.stringify(item)}`);

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
connection.onRequest('executeAll', (params, token) => {
  return new Promise((resolve) => {
    // Use Node worker threads to isolate each run of a playground
    // to be able to cancel evaluation of infinite loops.
    //
    // There is an issue with support for `.ts` files.
    // Trying to run a `.ts` file in a worker thread results in error:
    // `The worker script extension must be “.js” or “.mjs”. Received “.ts”`
    // As a workaround require `.js` file from the out folder.
    //
    // TODO: After webpackifying the extension replace
    // the workaround with some similar 3rd-party plugin
    const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
      // The workerData parameter sends data to the created worker
      workerData: {
        codeToEvaluate: params.codeToEvaluate,
        connectionString,
        connectionOptions,
      },
    });

    // Evaluate runtime in the worker thread
    worker.postMessage('executeAll');

    // Listen for results from the worker thread
    worker.on('message', ([error, result]) => {
      if (error) {
        connection.sendNotification('showErrorMessage', error.message);
      }

      worker.terminate(); // Close the worker thread

      return resolve(result);
    });

    // Listen for cancellation request from the language server client
    token.onCancellationRequested(async () => {
      console.log('Playground cancellation requested');
      connection.sendNotification(
        'showInformationMessage',
        'The running playground operation was canceled.'
      );

      // If there is a situation that mongoClient is unresponsive,
      // try to close mongoClient after each runtime evaluation
      // and after the cancelation of the runtime
      // to make sure that all resources are free and can be used with a new request.
      //
      // (serviceProvider as any)?.mongoClient.close(false);
      //
      // The mongoClient.close method closes the underlying connector,
      // which in turn closes all open connections.
      // Once called, this mongodb instance can no longer be used.
      //
      // See: https://github.com/mongodb-js/vscode/pull/54

      // Stop the worker and all JavaScript execution
      // in the worker thread as soon as possible
      worker.terminate().then((status) => {
        console.log(`Playground canceled with status: ${status}`);
      });
    });
  });
});

/**
 * Execute a single block of code in the playground.
 */
connection.onRequest('executeRange', (event) => {
  // console.log(`executeRange: ${JSON.stringify(event)}`);

  return '';
});

connection.onRequest('textDocument/rangeFormatting', (event) => {
  // console.log(
  //   `textDocument/rangeFormatting: ${JSON.stringify({ event })}`
  // );

  const text = documents?.get(event?.textDocument?.uri)?.getText(event.range);

  return text;
});

connection.onRequest('textDocument/formatting', (event) => {
  const document = documents.get(event.textDocument.uri);
  const text = document?.getText();
  const range = {
    start: { line: 0, character: 0 },
    end: { line: document?.lineCount, character: 0 },
  };

  // console.log(
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
  // console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
  // The content of a text document did change in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  // console.log(
  //   `${params.textDocument.uri} changed: ${JSON.stringify(
  //     params.contentChanges
  //   )}`
  // );
});
connection.onDidCloseTextDocument((params) => {
  // A text document got closed in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // console.log(`${params.textDocument.uri} closed.`);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
