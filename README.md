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

#### Code Tour

- `out` compiled extension code
- `resources` static assets like images that will be copied directly into the extension bundle
- `src`
  - `test/suite` where tests live with files names `*.test.ts`
- `scripts` project helper scripts

## License

Apache 2.0
