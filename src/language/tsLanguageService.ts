/* ---------------------------------------------------------------------------------------------
 * See the bundled JavaScript extension of VSCode:
 * https://github.com/microsoft/vscode/blob/main/extensions/html-language-features/server/src/modes/javascriptMode.ts
 *-------------------------------------------------------------------------------------------- */

import type {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  CompletionItem,
} from 'vscode-languageserver/node';
import { CompletionItemKind } from 'vscode-languageserver/node';
import ts from 'typescript';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { join } from 'path';

type TypeScriptServiceHost = {
  getLanguageService(jsDocument: TextDocument): ts.LanguageService;
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
  typeParameter = 'type parameter',
}

// eslint-disable-next-line complexity
const convertKind = (kind: string): CompletionItemKind => {
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
};

const GLOBAL_CONFIG_LIBRARY_NAME = 'global.d.ts';

export default class TypeScriptService {
  _host: TypeScriptServiceHost;
  _extensionPath?: string;
  _contents: { [name: string]: string } = Object.create(null);

  constructor() {
    this._host = this._getTypeScriptServiceHost();
  }

  /**
   * The absolute file path of the directory containing the extension.
   */
  setExtensionPath(extensionPath: string): void {
    this._extensionPath = extensionPath;
  }

  /**
   * Load files related to the language features.
   */
  _loadLibrary(name: string) {
    if (!this._extensionPath) {
      console.error(
        `Unable to load library ${name}: extensionPath is undefined`
      );
      return '';
    }

    let libPath;

    if (name === GLOBAL_CONFIG_LIBRARY_NAME) {
      libPath = join(this._extensionPath, name);
    }

    let content = this._contents[name];

    if (typeof content !== 'string' && libPath) {
      try {
        content = readFileSync(libPath, 'utf8');
      } catch (e) {
        console.error(`Unable to load library ${name} at ${libPath}`);
        content = '';
      }

      this._contents[name] = content;
    }

    return content;
  }

  _getTypeScriptServiceHost(): TypeScriptServiceHost {
    const compilerOptions = {
      allowNonTsExtensions: true,
      allowJs: true,
      target: ts.ScriptTarget.Latest,
      moduleResolution: ts.ModuleResolutionKind.Classic,
      experimentalDecorators: false,
    };
    let currentTextDocument = TextDocument.create('init', 'plaintext', 1, '');

    // Create the language service host to allow the LS to communicate with the host.
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => compilerOptions,
      getScriptFileNames: () => [
        currentTextDocument.uri,
        GLOBAL_CONFIG_LIBRARY_NAME,
      ],
      getScriptKind: () => ts.ScriptKind.JS,
      getScriptVersion: (fileName: string) => {
        if (fileName === currentTextDocument.uri) {
          return String(currentTextDocument.version);
        }
        return '1';
      },
      getScriptSnapshot: (fileName: string) => {
        let text = '';
        if (fileName === currentTextDocument.uri) {
          text = currentTextDocument.getText();
        } else {
          text = this._loadLibrary(fileName);
        }
        return {
          getText: (start, end) => text.substring(start, end),
          getLength: () => text.length,
          getChangeRange: () => undefined,
        };
      },
      getCurrentDirectory: () => '',
      getDefaultLibFileName: () => GLOBAL_CONFIG_LIBRARY_NAME,
      readFile: (): string | undefined => undefined,
      fileExists: (): boolean => false,
      directoryExists: (): boolean => false,
    };

    // Create the language service files.
    const jsLanguageService = ts.createLanguageService(host);

    return {
      // Return a language service instance for a document.
      getLanguageService(jsDocument: TextDocument): ts.LanguageService {
        currentTextDocument = jsDocument;
        return jsLanguageService;
      },
      getCompilationSettings() {
        return compilerOptions;
      },
      dispose() {
        jsLanguageService.dispose();
      },
    };
  }

  doSignatureHelp(
    document: TextDocument,
    position: Position
  ): Promise<SignatureHelp | null> {
    const jsDocument = TextDocument.create(
      document.uri,
      'javascript',
      document.version,
      document.getText()
    );
    const jsLanguageService = this._host.getLanguageService(jsDocument);
    const signHelp = jsLanguageService.getSignatureHelpItems(
      jsDocument.uri,
      jsDocument.offsetAt(position),
      undefined
    );

    if (signHelp) {
      const ret: SignatureHelp = {
        activeSignature: signHelp.selectedItemIndex,
        activeParameter: signHelp.argumentIndex,
        signatures: [],
      };
      signHelp.items.forEach((item) => {
        const signature: SignatureInformation = {
          label: '',
          documentation: undefined,
          parameters: [],
        };

        signature.label += ts.displayPartsToString(item.prefixDisplayParts);
        item.parameters.forEach((p, i, a) => {
          const label = ts.displayPartsToString(p.displayParts);
          const parameter: ParameterInformation = {
            label: label,
            documentation: ts.displayPartsToString(p.documentation),
          };
          signature.label += label;
          signature.parameters?.push(parameter);
          if (i < a.length - 1) {
            signature.label += ts.displayPartsToString(
              item.separatorDisplayParts
            );
          }
        });
        signature.label += ts.displayPartsToString(item.suffixDisplayParts);
        ret.signatures.push(signature);
      });
      return Promise.resolve(ret);
    }
    return Promise.resolve(null);
  }

  doComplete(document: TextDocument, position: Position): CompletionItem[] {
    const jsDocument = TextDocument.create(
      document.uri,
      'javascript',
      document.version,
      document.getText()
    );
    const jsLanguageService = this._host.getLanguageService(jsDocument);
    const offset = jsDocument.offsetAt(position);
    const jsCompletion = jsLanguageService.getCompletionsAtPosition(
      jsDocument.uri,
      offset,
      {
        includeExternalModuleExports: false,
        includeInsertTextCompletions: false,
      }
    );

    return (
      jsCompletion?.entries.map((entry) => {
        // Data used for resolving item details (see 'doResolve').
        const data = {
          languageId: 'javascript',
          uri: document.uri,
          offset: offset,
        };
        return {
          uri: document.uri,
          position: position,
          label: entry.name,
          sortText: entry.sortText,
          kind: convertKind(entry.kind),
          data,
        };
      }) || []
    );
  }
}
