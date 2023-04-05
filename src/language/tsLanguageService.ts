import { Connection } from 'vscode-languageserver/node';
import type {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
} from 'vscode-languageserver/node';
import ts from 'typescript';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { join, basename, dirname } from 'path';

type TypeScriptServiceHost = {
  getLanguageService(jsDocument: TextDocument): ts.LanguageService;
  getCompilationSettings(): ts.CompilerOptions;
  dispose(): void;
};

// Server folder.
const serverPath =
  basename(__dirname) === 'dist'
    ? dirname(__dirname)
    : dirname(dirname(__dirname));

// TypeScript library folder.
const librarPath = join(serverPath, 'node_modules/typescript/lib');
const contents: { [name: string]: string } = {};

export default class TypeScriptService {
  _connection: Connection;
  _host: TypeScriptServiceHost;

  constructor(connection: Connection) {
    this._host = this._getTypeScriptServiceHost();
    this._connection = connection;
  }

  _loadLibrary(name: string) {
    let content = contents[name];
    if (typeof content !== 'string' && librarPath) {
      const libPath = join(librarPath, name); // From source.
      try {
        content = readFileSync(libPath).toString();
      } catch (e) {
        this._connection.console.error(
          `Unable to load library ${name} at ${libPath}`
        );
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
      lib: ['lib.es2020.full.d.ts'], // Should match to lib from tsconfig.json.
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
      getDefaultLibFileName: () => 'es2020.full', // Should match to lib from tsconfig.json.
      readFile: (path: string): string | undefined => {
        if (path === currentTextDocument.uri) {
          return currentTextDocument.getText();
        }
        return this._loadLibrary(path);
      },
      fileExists: (path: string): boolean => {
        if (path === currentTextDocument.uri) {
          return true;
        }
        return !!this._loadLibrary(path);
      },
      directoryExists: (path: string): boolean => {
        // Typescript tries to first find libraries in node_modules/@types and node_modules/@typescript.
        if (path.startsWith('node_modules')) {
          return false;
        }
        return true;
      },
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
  ): SignatureHelp | null {
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
      return ret;
    }
    return null;
  }
}
