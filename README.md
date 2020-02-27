# :construction: MongoDB VSCode [Work in Progress] :construction:

[![Build Status](https://dev.azure.com/team-compass/team-compass/_apis/build/status/mongodb-js.vscode?branchName=master)](https://dev.azure.com/team-compass/team-compass/_build/latest?definitionId=4&branchName=master)

Official MongoDB Visual Studio Code Extension. **Not Yet Released**.

> brought to you by the [Compass](https://github.com/mongodb-js/compass) team

## Features

### :construction:

## Extension Settings

`mdb.show`: Show/Hide the MongoDB extension.
`mdb.shell`: The MongoDB shell to use.
`mdb.defaultLimit`: The limit of documents to fetch when viewing documents from a collection.
`mdb.connectionSaving.hideOptionToChooseWhereToSaveNewConnections`: When a connection is added, a prompt is shown that let's the user decide where the new connection should be saved. When this setting is checked, the prompt is not shown and the default connection saving location setting is used.
`mdb.connectionSaving.defaultConnectionSavingLocation`: When the setting that hides the option to choose where to save new connections is checked, this setting sets if and where new connections are saved.

*See `package.json` `contributes.configuration` for a full list of settings.*

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
