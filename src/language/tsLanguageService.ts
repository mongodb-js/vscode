/* ---------------------------------------------------------------------------------------------
 * See the bundled extension of VSCode as an example:
 * https://github.com/microsoft/vscode/blob/main/extensions/html-language-features/server/src/modes/javascriptMode.ts
 *-------------------------------------------------------------------------------------------- */
import ts from 'typescript';
import type {
  SignatureHelp,
  SignatureInformation,
  ParameterInformation,
  CompletionItem,
} from 'vscode-languageserver/node';
import { TextDocument, Position } from 'vscode-languageserver-textdocument';

import { loadLibrary, GLOBAL_CONFIG_LIBRARY_NAME } from './loadLibrary';
import { convertKind } from './convertKind';

type TypeScriptServiceHost = {
  getLanguageService(jsDocument: TextDocument): ts.LanguageService;
  getCompilationSettings(): ts.CompilerOptions;
  dispose(): void;
};

export default class TypeScriptService {
  _host: TypeScriptServiceHost;
  _extensionPath?: string;

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
   * Create a TypeScript service host.
   */
  _getTypeScriptServiceHost(): TypeScriptServiceHost {
    const compilerOptions = {
      allowNonTsExtensions: true,
      allowJs: true,
      target: ts.ScriptTarget.Latest,
      moduleResolution: ts.ModuleResolutionKind.Classic,
      experimentalDecorators: false,
    };
    let currentTextDocument = TextDocument.create('init', 'javascript', 1, '');

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
      getScriptSnapshot: (libraryName: string) => {
        let text = '';
        if (libraryName === currentTextDocument.uri) {
          text = currentTextDocument.getText();
        } else {
          text = loadLibrary({
            libraryName,
            extensionPath: this._extensionPath,
          });
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
    const languageService = ts.createLanguageService(host);

    return {
      // Return a language service instance for a document.
      getLanguageService(jsDocument: TextDocument): ts.LanguageService {
        currentTextDocument = jsDocument;
        return languageService;
      },
      getCompilationSettings() {
        return compilerOptions;
      },
      dispose() {
        languageService.dispose();
      },
    };
  }

  /**
   * Provide MongoDB signature help.
   */
  doSignatureHelp({
    document,
    position,
  }: {
    document: TextDocument;
    position: Position;
  }): Promise<SignatureHelp | null> {
    const jsDocument = TextDocument.create(
      document.uri,
      'javascript',
      document.version,
      document.getText()
    );
    const languageService = this._host.getLanguageService(jsDocument);
    const signHelp = languageService.getSignatureHelpItems(
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

  /**
   * Provide MongoDB completions.
   * This is a draft method that can replace completions currently provided by the MongoDBService.
   *
   * TODO:
   *  - Provide the full completion list.
   *  - Use a proper icon.
   *  - Display description.
   *  - Include a link to the documentation.
   */
  doComplete({
    document,
    position,
  }: {
    document: TextDocument;
    position: Position;
  }): CompletionItem[] {
    const jsDocument = TextDocument.create(
      document.uri,
      'javascript',
      document.version,
      document.getText()
    );
    const languageService = this._host.getLanguageService(jsDocument);
    const offset = jsDocument.offsetAt(position);
    const jsCompletion = languageService.getCompletionsAtPosition(
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
