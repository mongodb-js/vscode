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
  CompletionItemKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import MongoDBService from './mongoDBService';
import { ServerCommands } from './serverCommands';
import {
  PlaygroundExecuteParameters,
  PlaygroundTextAndSelection,
} from '../types/playgroundType';

import * as ts from 'typescript';

import * as util from 'util';

let extensionPath: any;

const enum Kind {
	alias = 'alias',
	callSignature = 'call',
	class = 'class',
	const = 'const',
	constructorImplementation = 'constructor',
	constructSignature = 'construct',
	directory = 'directory',
	enum = 'enum',
	enumMember = 'enum member',
	externalModuleName = 'external module name',
	function = 'function',
	indexSignature = 'index',
	interface = 'interface',
	keyword = 'keyword',
	let = 'let',
	localFunction = 'local function',
	localVariable = 'local var',
	method = 'method',
	memberGetAccessor = 'getter',
	memberSetAccessor = 'setter',
	memberVariable = 'property',
	module = 'module',
	primitiveType = 'primitive type',
	script = 'script',
	type = 'type',
	variable = 'var',
	warning = 'warning',
	string = 'string',
	parameter = 'parameter',
	typeParameter = 'type parameter'
}

// eslint-disable-next-line complexity
function convertKind(kind: string): CompletionItemKind {
	switch (kind) {
		case Kind.primitiveType:
		case Kind.keyword:
			return CompletionItemKind.Keyword;

		case Kind.const:
		case Kind.let:
		case Kind.variable:
		case Kind.localVariable:
		case Kind.alias:
		case Kind.parameter:
			return CompletionItemKind.Variable;

		case Kind.memberVariable:
		case Kind.memberGetAccessor:
		case Kind.memberSetAccessor:
			return CompletionItemKind.Field;

		case Kind.function:
		case Kind.localFunction:
			return CompletionItemKind.Function;

		case Kind.method:
		case Kind.constructSignature:
		case Kind.callSignature:
		case Kind.indexSignature:
			return CompletionItemKind.Method;

		case Kind.enum:
			return CompletionItemKind.Enum;

		case Kind.enumMember:
			return CompletionItemKind.EnumMember;

		case Kind.module:
		case Kind.externalModuleName:
			return CompletionItemKind.Module;

		case Kind.class:
		case Kind.type:
			return CompletionItemKind.Class;

		case Kind.interface:
			return CompletionItemKind.Interface;

		case Kind.warning:
			return CompletionItemKind.Text;

		case Kind.script:
			return CompletionItemKind.File;

		case Kind.directory:
			return CompletionItemKind.Folder;

		case Kind.string:
			return CompletionItemKind.Constant;

		default:
			return CompletionItemKind.Property;
	}
}

function getLanguageServiceHost(scriptKind: ts.ScriptKind) {
	const compilerOptions: ts.CompilerOptions = { allowNonTsExtensions: true, allowJs: true, lib: ['lib.es2020.full.d.ts'], target: ts.ScriptTarget.Latest, moduleResolution: ts.ModuleResolutionKind.Classic, experimentalDecorators: false };

	let currentTextDocument = TextDocument.create('init', 'javascript', 1, '');
	const jsLanguageService = import('./modes/javascriptLibs').then(libs => {
		const host: ts.LanguageServiceHost = {
			getCompilationSettings: () => compilerOptions,
			getScriptFileNames: () => [currentTextDocument.uri, 'jquery'],
			getScriptKind: (fileName) => {
				if (fileName === currentTextDocument.uri) {
					return scriptKind;
				}
				return fileName.substr(fileName.length - 2) === 'ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
			},
			getScriptVersion: (fileName: string) => {
				if (fileName === currentTextDocument.uri) {
					return String(currentTextDocument.version);
				}
				return '1'; // default lib an jquery.d.ts are static
			},
			getScriptSnapshot: (fileName: string) => {
				let text = '';
				if (fileName === currentTextDocument.uri) {
					text = currentTextDocument.getText();
				} else {
					text = libs.loadLibrary(extensionPath, fileName);
				}
				return {
					getText: (start, end) => text.substring(start, end),
					getLength: () => text.length,
					getChangeRange: () => undefined
				};
			},
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => 'es2020.full',
			readFile: (path: string): string | undefined => {
				if (path === currentTextDocument.uri) {
					return currentTextDocument.getText();
				}
        return libs.loadLibrary(extensionPath, path);
			},
			fileExists: (path: string): boolean => {
				if (path === currentTextDocument.uri) {
					return true;
				}
        return !!libs.loadLibrary(extensionPath, path);
			},
			directoryExists: (path: string): boolean => {
				// typescript tries to first find libraries in node_modules/@types and node_modules/@typescript
				// there's no node_modules in our setup
				if (path.startsWith('node_modules')) {
					return false;
				}
				return true;
			}
		};
		return ts.createLanguageService(host);
	});
	return {
		async getLanguageService(jsDocument: TextDocument): Promise<ts.LanguageService> {
			currentTextDocument = jsDocument;
			return jsLanguageService;
		},
		getCompilationSettings() {
			return compilerOptions;
		},
		dispose() {
			void jsLanguageService.then(s => s.dispose());
		}
	};
}

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: Connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
// The text document manager supports full document sync only.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// MongoDB Playground Service Manager.
const mongoDBService = new MongoDBService(connection);

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

// The example settings
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
  // connection.console.log(`documents.onDidClose: ${JSON.stringify(e)}`);

  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((/* change */) => {
  // connection.console.log(
  //   `documents.onDidChangeContent: ${JSON.stringify(change)}`
  // );
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

// Execute the entire playground script.
connection.onRequest(
  ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND,
  (executionParameters: PlaygroundExecuteParameters, token) => {
    return mongoDBService.executeAll(executionParameters, token);
  }
);

connection.onRequest(ServerCommands.SET_EXTENSION_PATH, (_extensionPath) => {
  extensionPath = _extensionPath;
  return mongoDBService.setExtensionPath(_extensionPath);
});

// Connect to CliServiceProvider to enable shell completions.
connection.onRequest(ServerCommands.CONNECT_TO_SERVICE_PROVIDER, (params) => {
  return mongoDBService.connectToServiceProvider(params);
});

// Clear connectionString and connectionOptions values
// when there is no active connection.
connection.onRequest(ServerCommands.DISCONNECT_TO_SERVICE_PROVIDER, () => {
  return mongoDBService.disconnectFromServiceProvider();
});

connection.onRequest(
  ServerCommands.GET_EXPORT_TO_LANGUAGE_MODE,
  (params: PlaygroundTextAndSelection) => {
    return mongoDBService.getExportToLanguageMode(params);
  }
);

connection.onRequest(
  ServerCommands.GET_NAMESPACE_FOR_SELECTION,
  (params: PlaygroundTextAndSelection) => {
    return mongoDBService.getNamespaceForSelection(params);
  }
);

// This handler provides the list of the completion items.
connection.onCompletion(async (params: TextDocumentPositionParams) => {
  const host = getLanguageServiceHost(ts.ScriptKind.JS);
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return;
  }

  const jsDocument = TextDocument.create(document.uri, 'javascript', document.version, document.getText());

  const jsLanguageService = await host.getLanguageService(jsDocument);


  const offset = jsDocument.offsetAt(params.position);

	const jsCompletion = jsLanguageService.getCompletionsAtPosition(jsDocument.uri, offset, { includeExternalModuleExports: false, includeInsertTextCompletions: false });
  const jsCompletionItems = jsCompletion?.entries.map(entry => {
    const data = { // data used for resolving item details (see 'doResolve')
      languageId: 'mongodb',
      uri: document.uri,
      offset: offset
    };
    return {
      uri: document.uri,
      position: params.position,
      label: entry.name,
      sortText: entry.sortText,
      kind: convertKind(entry.kind),
      data
    };
  }) || [];

  connection.console.log('jsCompletionItems----------------------');
  connection.console.log(`${util.inspect(jsCompletionItems)}`);
  connection.console.log('----------------------');

  const textFromEditor = documents.get(params.textDocument.uri)?.getText();

  const mongodbCompletions = await mongoDBService.provideCompletionItems(
    textFromEditor ? textFromEditor : '',
    params.position
  );

  return [...jsCompletionItems, ...mongodbCompletions];
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
