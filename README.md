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

`vscode-mongodb` will be published under the `mongodb` Visual Studio Marketplace Publisher that has been setup under the existing `team-compass` Azure DevOps org we use for pipelines.

Azure Org:
`team-compass`

[Azure Org Owner User](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/change-organization-ownership?view=azure-devops):
`team-compass@mongodb.com`

Azure Projects:

- `vscode` The MongoDB VSCode Extension https://github.com/mongodb-js/vscode
- `mongosh` The MongoDB Shell https://github.com/mongodb-js/mongosh
- `compass` Compass plugins

Visual Studio Marketplace:

- Publisher `mongodb`

- `vscode-marketplace@mongodb.com` is a member of the `team-compass` Azure DevOps Org
  https://groups.google.com/a/mongodb.com/forum/#!forum/vscode-marketplace

- `vscode@mongodb.com` is contact email to use for this project
  https://groups.google.com/a/mongodb.com/forum/#!forum/vscode

* [docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
* [web ui](https://marketplace.visualstudio.com/manage/publishers/mongodb)
* Analytics: [Extension Reporting Hub](https://devblogs.microsoft.com/devops/extension-reporting-hub-for-marketplace-publishers/)

### Preview

While [private extensions are not currently supported](https://github.com/microsoft/vscode/issues/21839), the extension can be packaged as a `.vsix` file and shared directly.

To create a `.vsix`:

```bash
npm i -g vsce;
vsce package;
```

This will create a file like `mongodb-vscode-0.0.1.vsix`. Once downloaded, the extension can be installed with the [Install .VSIX](https://github.com/fabiospampinato/vscode-install-vsix) or by running:

```bash
code --install-extension mongodb-vscode-0.0.1.vsix
```

## License

Apache 2.0
