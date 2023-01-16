import {
  CompletionItemKind,
  Connection,
  CompletionItem,
} from 'vscode-languageserver/node';
import * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';

type LanguageServiceHost = {
  getLanguageService(jsDocument: TextDocument): Promise<ts.LanguageService>;
  getCompilationSettings(): ts.CompilerOptions;
  dispose(): void;
};

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

function getLanguageServiceHost(extensionPath, scriptKind: ts.ScriptKind) {
	const compilerOptions: ts.CompilerOptions = { allowNonTsExtensions: true, allowJs: true, lib: ['lib.es2020.full.d.ts'], target: ts.ScriptTarget.Latest, moduleResolution: ts.ModuleResolutionKind.Classic, experimentalDecorators: false };

	let currentTextDocument = TextDocument.create('init', 'javascript', 1, '');
	const jsLanguageService = import('./javascriptLibs').then((libs) => {
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

export default class JavascriptService {
  _connection: Connection;
  _extensionPath?: string;
  _host?: LanguageServiceHost;

  constructor(connection: Connection) {
    this._connection = connection;
  }

  setExtensionHost(extensionPath: string): void {
    if (!extensionPath) {
      this._connection.console.error(
        'Set extensionPath error: extensionPath is undefined'
      );
    } else {
      this._extensionPath = extensionPath;
      this._host = getLanguageServiceHost(this._extensionPath, ts.ScriptKind.JS);
    }
  }

  async provideCompletionItems(
    document: TextDocument,
    position: { line: number; character: number },
  ): Promise<CompletionItem[]> {
    if (!this._host) {
      this._connection.console.error(
        'Provide JS completion items: the js language service host is undefined'
      );
      return [];
    }

    const jsDocument = TextDocument.create(document.uri, 'javascript', document.version, document.getText());
    const jsLanguageService = await this._host.getLanguageService(jsDocument);
    const offset = jsDocument.offsetAt(position);
    const jsCompletion = jsLanguageService.getCompletionsAtPosition(jsDocument.uri, offset, { includeExternalModuleExports: false, includeInsertTextCompletions: false });

    return jsCompletion?.entries.map((entry) => {
      const data = { // data used for resolving item details (see 'doResolve')
        languageId: 'mongodb',
        uri: document.uri,
        offset: offset
      };
      return {
        uri: document.uri,
        position: position,
        label: entry.name,
        sortText: entry.sortText,
        kind: convertKind(entry.kind),
        data
      };
    }) || [];
  }
}
