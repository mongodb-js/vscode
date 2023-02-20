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

- `out` - Compiled extension code
- `images` - Icons, logos, etc.
- `snippets` - Bundled MongoDB Snippets
- `syntaxes` [Syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars) for MongoDB keywords
- `src`
  - `test/suite` - Where tests live with '`*.test.ts`' files names
- `scripts` - Project helper scripts

## Releases

The MongoDB VSCode extension is not released on a set schedule. A new version is released on demand or when there are some features ready to go live.

### Releasing

Releases are automated using github actions, and published to the VSCode marketplace using a Personal Access Token (PAT). For additional information and reading, VSCode has some great documentation on publishing extensions:
https://code.visualstudio.com/api/working-with-extensions/publishing-extension
https://code.visualstudio.com/api/working-with-extensions/continuous-integration

1. To kick off a release run `npm run release-draft *.*.*|major|minor|patch` on the main branch. This will run the [release draft script](https://github.com/mongodb-js/vscode/blob/main/scripts/release-draft.js) which creates a new tag for the release.
1. When that tag has been created, a GitHub action for building the extension is automatically started: https://github.com/mongodb-js/vscode/blob/main/.github/workflows/test-and-build.yaml This creates the `.vsix` artifact for that release version and creates a draft GitHub release, with the `.vsix` artifact attached. At this point you can look in https://github.com/mongodb-js/vscode/releases and see the draft release.
1. Now is a good time to download the built `.vsix` artifact in the new [GitHub release draft](https://github.com/mongodb-js/vscode/releases) and ensure it works smoothly. https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix
1. Update the [release notes](https://github.com/mongodb-js/vscode/releases) in GitHub, documenting user facing changes. Once you’re happy with the changes you can publish the release.
1. When the release is published, the GitHub action https://github.com/mongodb-js/vscode/blob/main/.github/workflows/publish-release.yaml is automatically run, which downloads the release artifact and then publishes it to the VSCode marketplace.
1. Nice! ✨ Now you can verify it all completed by visiting https://marketplace.visualstudio.com/items?itemName=mongodb.mongodb-vscode and seeing the new version is up. You also try installing it in VSCode :) ✨
1. Lastly, don't forget to post in slack, let all your friends know, and close the release ticket in jira if there is one.
