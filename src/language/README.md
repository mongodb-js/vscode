# MongoDB for VS Code: Language Server

## Jargon

**LangServer Protocol** The Language Server protocol (LSP) is used between a tool (the client) and a language smartness provider (the server) to integrate features like auto complete, go to definition, find all references and alike into the tool https://microsoft.github.io/language-server-protocol

**MongoDB Language Server Server** runs as a separate node.js process using [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node/tree/master/server)

**MongoDB Language Server Client** runs next to UI code in the extension host process and uses [vscode-languageclient](https://github.com/microsoft/vscode-languageserver-node/tree/master/client) for JSON RPC over IPC.

![](./langserver-diagram.svg)

## Intro

- The Language Server implementation for the official MongoDB extension for Visual Studio Code worthy of its own team scope/design

## Motivation

All of the User Facing Behaviors are possible with the extension host `vscode` API. However, LSP provides the following benefits:

- Single-source of truth for the brains/semantics of MongoDB
- Provides performant way to enable UX for potentially intensive processing off the "main UI thread"
- Support existing mongosh scripts `.js` as well as newly created playgrounds `.mongodb`
- Differentiates from nights and weekends extensions with polish/pro version
- Server use other products not javascript eg. golang binary for SQL support with BIC (ex. MS SQL, C#)
- that could be integrated into other enterprise tools like Compass and mongosh
- Expand to support external developer tools like Sublime Text, JetBrains/IntelliJ, Atom, vim, emacs, [and more](#other-lsp-clients)

## User Facing Behavior

Some of the LangServer spec and VSCode user functionality can be confusing. Map of LSP request methods to VSCode UX along with possible features the MongoDB extension could add for playgrounds MDB Language Server:

- formatting
- signatures
- hovers
- diagnostics
- definitions
- completions
- codeActions

### formatting

[official docs][vscode_docs_formatting]

- Run prettier on file/selected range
-

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/format-document.gif)

### signatures

[docs][vscode_docs_signatures]

- mongosh function/method parameters and their types with short description
-

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/signature-help.gif)

### hovers

[docs][vscode_docs_hovers]

- Show type information and include documentation (like a simpler `signature`)
- Show mini-schema view when hovering over a collection name
-

* ![](https://user-images.githubusercontent.com/23074/70480573-15c3b300-1aae-11ea-80d5-51461a07839f.png)

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/hovers.gif)

### diagnostics

[docs][vscode_docs_diagnostics]

- eslint errors/warnings on playground files (red or yellow squiggles)
-

> scott 1 day ago
> Ah I’m glad it’s started well! :slightly_smiling_face: personally I think this is /huge/ when you consider how many developer tools can now leverage all the work the team is doing.
> and neat to play around with the ejsonShellParser :slightly_smiling_face: if you don’t already know it’ll throw an error with the line/column where it failed to parse which may be useful to show a red-squiggle.

### definitions

[docs][vscode_docs_definitions]

- Link to docs site
- Open mongosh source for a given method in a new editor tab
-

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/goto-definition.gif)

### completions

[docs][vscode_docs_completions]

> completions provide context sensitive suggestions to the user as they type

- mdb snippets
- mongosh SHELL API symbols/methods
- aggregation operators and field names within an aggregation pipeline
-

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/code-completion.gif)

### codeActions

[docs][vscode_docs_codeactions]

- Auto-fix method/field/operators typos (e.x. "fnd: did you mean find()?")

![](https://code.visualstudio.com/assets/api/language-extensions/language-support/quick-fixes.gif)

[vscode_docs_signatures]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#help-with-function-and-method-signatures
[vscode_docs_hovers]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-hovers
[vscode_docs_formatting]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#format-source-code-in-an-editor
[vscode_docs_diagnostics]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#provide-diagnostics
[vscode_docs_definitions]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-definitions-of-a-symbol
[vscode_docs_completions]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-code-completion-proposals
[vscode_docs_codeactions]: https://code.visualstudio.com/api/language-extensions/programmatic-language-features#possible-actions-on-errors-or-warnings

## Background Processing

We can also extend the mongodb language server and client with custom methods to leverage it as a background worker. Because the language server is a separate JSON RPC enabled process, we can add RPC definitions for:

- Execute playground with mongosh
- Schema analysis and caching

<a name="other-lsp-clients"></a>

## Other Tools w/ Language Server Client Integration

https://langserver.org/#implementations-client

Many tools integrate the client into their native experiences. A MongoDB Language Server implementation could be used to integrate with:

- VSCode
- vim/neovim
- Sublime Text 3
- MS Monaco Editor
- JupyterLab
- IntelliJ / JetBrains IDEs
- GNATStudio
- Emacs
- Eclipse
- CodeMirror
- Brackets
- Atom

## Language Server Implementations

https://microsoft.github.io/language-server-protocol/implementors/servers/

- Pretty much every Language you can think of.
- List of servers -> good examples to map into mdb server impl

## LangServer Notes

- Spec https://microsoft.github.io/language-server-protocol/specifications/specification-3-14/#textDocument_completion

Client Request Methods:

- completion
- completion resolve
- hover
- signatureHelp
- declaration
- definition
- typeDefinition
- implementation
- references
- documentHighlight
- documentSymbol
- codeAction
- codeLens
- codeLens resolve
- documentLink
- documentLink resolve
- documentColor
- colorPresentation
- formatting
- rangeFormatting
- onTypeFormatting
- rename
- prepareRename
- foldingRange

> NOTE (lucas) This is mostly a regurgitation of the docs so I can think out loud and keep notes. You may find the source material more useful: [programmatic language features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features) and
> [language server extension guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)

## Development

### Debugging

#### Output Channel

`MongoDB Language Server`

From server side: `connection.console.log(<string>)`

![MongoDB Language Server output channel](https://user-images.githubusercontent.com/23074/76441349-a489e980-6395-11ea-8247-50cfe9b3ff61.png)

#### Log Streaming + LSP Inspector

https://github.com/microsoft/vscode-extension-samples/tree/master/lsp-log-streaming-sample
https://microsoft.github.io/language-server-protocol/inspector/

In `.vscode/settings.json`

```json
"mongodbLanguageServer.trace.server": {
  "format": "json",
  "verbosity": "verbose"
},
```

#### LSP Notifications

From the server:

```javascript
connection.sendNotification('mongodbNotification', `Hi, Friend.`);
```

From the client:

```javascript
client.onNotification('mongodbNotification', (messsage) => {
  vscode.window.showInformationMessage(messsage);
});
```

![Screenshot 2020-03-11 12 04 42](https://user-images.githubusercontent.com/23074/76441224-74424b00-6395-11ea-8f28-f9e0387098e0.png)
