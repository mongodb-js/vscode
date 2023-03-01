# MongoDB Language Server

**MongoDB Language Server** runs as a separate node.js process using [vscode-languageserver](https://github.com/microsoft/vscode-languageserver-node/tree/master/server)

**MongoDB Language Client** runs next to UI code and uses [vscode-languageclient](https://github.com/microsoft/vscode-languageserver-node/tree/master/client) for JSON RPC over IPC.

![](./langserver-diagram.svg)

The language server protocol [(LSP)](https://microsoft.github.io/language-server-protocol/specification) is mainly used as a tool between the editor (the client) and a language smartness provider (the server) to integrate features like autocomplete, go to definition, find all references, list document symbols, signature help and much more. You can find the complete list of supported features in [the official documentation](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide).

We extend the mongodb language server and client with custom methods to leverage it as a background worker.

### Debugging

#### Client

Debugging the client code is as easy as debugging a normal extension. Set a breakpoint in the client code and debug the extension by pressing `F5`.

#### Server

Since the server is started by the `LanguageClient` running separately, we need to attach a debugger to the running server. To do so, switch to the Run view and select the launch configuration `Extension + Server Inspector` and press `F5`. This will run both the extension and the Server Inspector.

![MongoDB Language Server output channel](https://user-images.githubusercontent.com/23074/76441349-a489e980-6395-11ea-8247-50cfe9b3ff61.png)

### Logging Support

In `.vscode/settings.json` specify a `mongodbLanguageServer.trace.server` setting that instructs the Client to log communications between Language Client/Server to a channel of the Language Client's name.

```json
"mongodbLanguageServer.trace.server": {
  "format": "json",
  "verbosity": "verbose"
},
```

You can also configure logging from VSCode setting interface.

![MongoDB Language Server log settings](./lsp-trace-server.png)

The logs will be printed in the `MongoDB Language Server` Output Channel.

#### LSP Notifications

From the server:

```javascript
connection.sendNotification('showInformationMessage', `Hi, Friend.`);
```

From the client:

```javascript
client.onNotification('showInformationMessage', (messsage) => {
  vscode.window.showInformationMessage(messsage);
});
```

![Screenshot 2020-03-11 12 04 42](https://user-images.githubusercontent.com/23074/76441224-74424b00-6395-11ea-8f28-f9e0387098e0.png)
