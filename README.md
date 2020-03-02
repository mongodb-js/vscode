# :construction: MongoDB VSCode [Work in Progress] :construction:

[![Build Status](https://dev.azure.com/team-compass/team-compass/_apis/build/status/mongodb-js.vscode?branchName=master)](https://dev.azure.com/team-compass/team-compass/_build/latest?definitionId=4&branchName=master)

Official MongoDB Visual Studio Code Extension. **Not Yet Released**.

> brought to you by the [Compass](https://github.com/mongodb-js/compass) team

## Features

### :construction:

## Extension Settings

`mdb.show`: Show/Hide the MongoDB extension.

_See `package.json` `contributes.configuration` for a full list of settings._

## Contributing

For issues, please create a ticket in our [JIRA
Project](https://jira.mongodb.org/browse/VSCODE).

## Development

We recommend familiarizing yourself with the VSCode extension documentation:
[code.visualstudio.com/api](https://code.visualstudio.com/api).

Running the MongoDB VSCode plugin requires [Node.js](https://nodejs.org) and npm.

1. Clone this project, navigate to the folder, then run:

```shell
npm install
npm run watch
```

2. Inside of [VS Code Insiders](https://code.visualstudio.com/insiders/) open this directory and press `F5` to begin debugging the extension. This should launch a new VSCode window which is running the extension.

## Packaging

`vscode-mongodb` will be published under the `mongodb` Visual Studio Marketplace publisher that has been setup under the existing `team-compass` Azure DevOps org we use for pipelines.

- [docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [web ui](https://marketplace.visualstudio.com/manage/publishers/mongodb)
- Analytics: [Extension Reporting Hub](https://devblogs.microsoft.com/devops/extension-reporting-hub-for-marketplace-publishers/)
- TODO (lucas) Read more carefully and update for any musts: https://code.visualstudio.com/api/references/extension-manifest#marketplace-presentation-tips
- TODO (lucas) metrics: [sessionId and machineId from `vscode.env`](https://github.com/microsoft/vscode-extension-telemetry/blob/master/src/telemetryReporter.ts#L92)
- TODO (lucas) Extension install/uninstall hooks https://code.visualstudio.com/api/references/extension-manifest#extension-uninstall-hook
- TODO (lucas): ticket: pattern for examples/libraries to [add mongodb-vscode as recommended extension](https://code.visualstudio.com/docs/editor/extension-gallery#_workspace-recommended-extensions)
- TODO (lucas) Finish design for driver specific bundling like `MongoDB for .Net`, MongoDB for Python, etc. using [extension packs](https://code.visualstudio.com/api/references/extension-manifest#extension-packs)
- TODO (lucas) Ticket: for bundle size and perf https://dev.to/sneezry/how-to-speed-up-your-vs-code-extension-not-only-webpack-48b5 and https://github.com/microsoft/vscode-extension-samples/tree/master/webpack-sample and https://github.com/microsoft/vscode-azuretools/blob/master/dev/src/webpack/excludeNodeModulesAndDependencies.ts and https://johnpapa.net/is-your-vs-code-extension-slow-heres-how-to-speed-it-up/
- TODO (lucas): The Azure Personal Access Token for publishing the vscode extension. It expires: Jan 2 2021 at which point a new one will need to be generated.

### Preview

While [private extensions are not currently supported](https://github.com/microsoft/vscode/issues/21839), the extension can be packaged as a `.vsix` file and shared directly.

To create a `.vsix`:

```bash
npm i -g vsce;
vsce package;
```

This will create a file like `mongodb-vscode-0.0.1.vsix`. Once downloaded, the extension can be installed by running:

```bash
code --install-extension mongodb-vscode-0.0.1.vsix
```

## License

Apache 2.0
