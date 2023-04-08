import { Connection } from 'vscode-languageserver/node';
import type {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver/node';
import ts from 'typescript';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { join } from 'path';

type TypeScriptServiceHost = {
  getLanguageService(jsDocument: TextDocument): ts.LanguageService;
  getCompilationSettings(): ts.CompilerOptions;
  dispose(): void;
};

const contents: { [name: string]: string } = {};

// const TS_CONFIG_LIBRARY_NAME = 'es2022.full';
const MDB_CONFIG_LIBRARY_NAME = 'mongodb';
const GLOBAL_CONFIG_LIBRARY_NAME = 'global';

export default class TypeScriptService {
  _connection: Connection;
  _host: TypeScriptServiceHost;
  _extensionPath?: string;

  constructor(connection: Connection) {
    this._host = this._getTypeScriptServiceHost();
    this._connection = connection;
  }

  /**
   * The absolute file path of the directory containing the extension.
   */
  setExtensionPath(extensionPath: string): void {
    this._extensionPath = extensionPath;
  }

  _loadLibrary(name: string) {
    if (!this._extensionPath) {
      this._connection.console.error(
        'Unable to load library ${name}: extensionPath is undefined'
      );
      return '';
    }

    let content = contents[name];

    if (typeof content !== 'string') {
      let libPath;

      /* if (name === `lib.${TS_CONFIG_LIBRARY_NAME}.d.ts`) {
        libPath = join(this._extensionPath, 'node_modules/typescript/lib', name);
      } else */

      if (name === `${MDB_CONFIG_LIBRARY_NAME}.d.ts`) {
        libPath = join(this._extensionPath, 'node_modules/mongodb', name);
      } else if (name === `${GLOBAL_CONFIG_LIBRARY_NAME}.d.ts`) {
        libPath = join(this._extensionPath, 'src/types', name);
      } else {
        content = '';
      }

      if (libPath) {
        try {
          content = readFileSync(libPath, 'utf8');
        } catch (e) {
          this._connection.console.error(
            `Unable to load library ${name} at ${libPath}`
          );
          content = '';
        }
      } else {
        content = '';
      }

      contents[name] = content;
    }

    return content;
  }

  _getTypeScriptServiceHost() {
    const compilerOptions = {
      allowNonTsExtensions: true,
      allowJs: true,
      lib: [
        `${MDB_CONFIG_LIBRARY_NAME}.d.ts`,
        `${GLOBAL_CONFIG_LIBRARY_NAME}.d.ts`,
      ], // , `lib.${TS_CONFIG_LIBRARY_NAME}.d.ts`],
      target: ts.ScriptTarget.Latest,
      moduleResolution: ts.ModuleResolutionKind.Classic,
      experimentalDecorators: false,
    };
    let currentTextDocument = TextDocument.create('init', 'javascript', 1, '');

    // Create the language service host to allow the LS to communicate with the host.
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => compilerOptions,
      getScriptFileNames: () => [currentTextDocument.uri],
      getScriptKind: () => {
        return ts.ScriptKind.JS;
      },
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
      readFile: (path: string): string | undefined => {
        if (path === currentTextDocument.uri) {
          return currentTextDocument.getText();
        }
        return this._loadLibrary(path);
      },
      fileExists: (): boolean => false,
      directoryExists: (): boolean => false,
    };

    // Create the language service files.
    const jsLanguageService = ts.createLanguageService(host);

    return {
      // Return a new instance of the language service.
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
      signHelp.items
        .map((item) => {
          const hasInt8Array = item.prefixDisplayParts.filter(
            (prefix) => prefix.text !== 'Int8Array'
          );
          item.prefixDisplayParts = hasInt8Array;
          return item;
        })
        .forEach((item) => {
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
}
