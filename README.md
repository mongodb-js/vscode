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

### Preview

The extension can be packaged as a shareable `.vsix` file you can send to others without publishing public releases to the VS Code MarketPlace.

To create a `.vsix`, run the below from the root of your repo:

```bash
npm i -g vsce;
vsce package;
```

This will create a file like `mongodb-vscode-0.0.1.vsix` you can share it in Slack/Gmail/etc for others to download. The extension can then be installed by running

```bash
code --install-extension mongodb-vscode-0.0.1.vsix
```
