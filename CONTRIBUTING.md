# Contributing

## Workflow

MongoDB welcomes community contributions! If you’re interested in making a contribution to MongoDB Compass, please follow the steps below before you start writing any code:

1. Sign the [contributor's agreement](http://www.mongodb.com/contributor). This will allow us to review and accept contributions.
1. Fork the repository on GitHub
1. Create a branch with a name that briefly describes your feature
1. Implement your feature or bug fix
1. Add new cases to `./src/test` that verify your bug fix or make sure no one
   unintentionally breaks your feature in the future and run them with `npm test`
1. Add comments around your new code that explain what's happening
1. Commit and push your changes to your branch then submit a pull request

## Bugs

You can report new bugs by
[creating a new issue](https://jira.mongodb.org/browse/VSCODE/).
Please include as much information as possible about your environment.

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
- `images` Icons, logos, etc.
- `snippets` [Bundled MongoDB Snippets][snippet guide]
- `syntaxes` [Syntax highlighting for `.mongodb` files][syntax guide]
- `src`
  - `test/suite` where tests live with files names `*.test.ts`
- `scripts` project helper scripts
