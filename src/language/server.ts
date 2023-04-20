import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentPositionParams,
  RequestType,
  TextDocumentSyncKind,
  Connection,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import MongoDBService from './mongoDBService';
import TypeScriptService from './tsLanguageService';

import { ServerCommands } from './serverCommands';
import {
  PlaygroundEvaluateParams,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: Connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
// The text document manager supports full document sync only.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// MongoDB language service.
const mongoDBService = new MongoDBService(connection);

// TypeScript language service.
const typeScriptService = new TypeScriptService();

let hasConfigurationCapability = false;
// let hasWorkspaceFolderCapability = false;
// let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  // hasWorkspaceFolderCapability = !!(
  //   capabilities.workspace && !!capabilities.workspace.workspaceFolders
  // );
  // hasDiagnosticRelatedInformationCapability = !!(
  //  capabilities.textDocument &&
  //  capabilities.textDocument.publishDiagnostics &&
  //  capabilities.textDocument.publishDiagnostics.relatedInformation
  // );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      textDocument: {
        completion: {
          completionItem: {
            preselectSupport: true,
          },
        },
      },
      // Tell the client that the server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.'],
      },
      // Tell the client that the server supports help signatures.
      signatureHelpProvider: {
        resolveProvider: true,
        triggerCharacters: [',', '('],
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
    void connection.client.register(
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

// The example settings.
interface ExampleSettings {
  maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
// const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
// let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents.
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((/* change */) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings.
    documentSettings.clear();
  } else {
    // globalSettings = <ExampleSettings>(
    //   (change.settings.mongodbLanguageServer || defaultSettings)
    // );
  }
});

// Only keep settings for open documents.
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(async (change) => {
  const textFromEditor = change.document.getText();

  const diagnostics = mongoDBService.provideDiagnostics(
    textFromEditor ? textFromEditor : ''
  );

  // Send the computed diagnostics to VSCode.
  await connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onRequest(new RequestType('textDocument/codeLens'), (/* event*/) => {
  // connection.console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(event)}`
  // );
  // const text = documents.get(event.textDocument.uri).getText();
  // const parsed = parseDocument(text);
  // return parsed;
});

connection.onDidChangeWatchedFiles((/* _change */) => {
  // Monitored files have change in VSCode.
  // connection.console.log(
  //   `We received an file change event: ${JSON.stringify(_change)}`
  // );
});

// Execute a playground.
connection.onRequest(
  ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
  (evaluateParams: PlaygroundEvaluateParams, token) => {
    return mongoDBService.evaluate(evaluateParams, token);
  }
);

// Pass the extension path to the MongoDB and TypeScript services.
connection.onRequest(ServerCommands.SET_EXTENSION_PATH, (extensionPath) => {
  mongoDBService.setExtensionPath(extensionPath);
  typeScriptService.setExtensionPath(extensionPath);
});

// Connect the MongoDB language service to CliServiceProvider
// using the current connection of the client.
connection.onRequest(ServerCommands.CONNECT_TO_SERVICE_PROVIDER, (params) => {
  return mongoDBService.connectToServiceProvider(params);
});

// Clear connectionString and connectionOptions values
// when there is no active connection.
connection.onRequest(ServerCommands.DISCONNECT_TO_SERVICE_PROVIDER, () => {
  return mongoDBService.disconnectFromServiceProvider();
});

// Set fields for tests.
connection.onRequest(
  ServerCommands.UPDATE_CURRENT_SESSION_FIELDS,
  ({ namespace, schemaFields }) => {
    return mongoDBService._cacheFields(namespace, schemaFields);
  }
);

// Identify if the playground selection is an array or object.
connection.onRequest(
  ServerCommands.GET_EXPORT_TO_LANGUAGE_MODE,
  (params: PlaygroundTextAndSelection) => {
    return mongoDBService.getExportToLanguageMode(params);
  }
);

// Find the current namespace for a playground selection.
connection.onRequest(
  ServerCommands.GET_NAMESPACE_FOR_SELECTION,
  (params: PlaygroundTextAndSelection) => {
    return mongoDBService.getNamespaceForSelection(params);
  }
);

// Provide MongoDB completion items.
connection.onCompletion((params: TextDocumentPositionParams) => {
  const document = documents.get(params.textDocument.uri);

  /* const document = documents.get(params.textDocument.uri);
  if (!document) {
    return Promise.resolve([]);
  }
  return typeScriptService.doComplete({
    document,
    position: params.position,
  }); */

  return mongoDBService.provideCompletionItems({
    document,
    position: params.position,
  });
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // connection.console.log(`onCompletionResolve: ${JSON.stringify(item)}`);

  // if (item.data === 1) {
  //   item.detail = 'TypeScript details';
  //   item.documentation = 'TypeScript documentation';
  // } else if (item.data === 2) {
  //   item.detail = 'JavaScript details';
  //   item.documentation = 'JavaScript documentation';
  // }

  return item;
});

// Provide MongoDB signature help.
connection.onSignatureHelp((signatureHelpParms) => {
  const document = documents.get(signatureHelpParms.textDocument.uri);

  if (!document) {
    return Promise.resolve(null);
  }

  // Provide MongoDB or TypeScript help signatures.
  return typeScriptService.doSignatureHelp({
    document,
    position: signatureHelpParms.position,
  });
});

connection.onRequest('textDocument/rangeFormatting', (event) => {
  // connection.console.log(
  //   `textDocument/rangeFormatting: ${JSON.stringify({ event })}`
  // );

  const text = documents?.get(event?.textDocument?.uri)?.getText(event.range);

  return text;
});

connection.onRequest('textDocument/formatting', (event) => {
  const document = documents.get(event.textDocument.uri);
  const text = document?.getText();
  // const range = {
  //   start: { line: 0, character: 0 },
  //   end: { line: document?.lineCount, character: 0 },
  // };

  // connection.console.log(
  //   `textDocument/formatting: ${JSON.stringify({
  //     text,
  //     options: event.options,
  //     range
  //   })}`
  // );

  return text;
});

connection.onDidOpenTextDocument((/* params */) => {
  // A text document got opened in VSCode.
  // params.textDocument.uri uniquely identifies the document. For documents store on disk this is a file URI.
  // params.textDocument.text the initial full content of the document.
  // connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidChangeTextDocument((/* params */) => {
  // The content of a text document did change in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // params.contentChanges describe the content changes to the document.
  // connection.console.log(
  //   `${params.textDocument.uri} changed: ${JSON.stringify(
  //     params.contentChanges
  //   )}`
  // );
});

connection.onDidCloseTextDocument((/* params */) => {
  // A text document got closed in VSCode.
  // params.textDocument.uri uniquely identifies the document.
  // connection.console.log(`${params.textDocument.uri} closed.`);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
