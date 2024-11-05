# Contributing

## Workflow

MongoDB welcomes community contributions! If you’re interested in making a contribution to MongoDB for VS Code, please follow the steps below before you start writing any code:

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

### Running Tests

#### Using the VSCode debugger

You can launch a debugging task for tests inside VSCode with the **"Run Tests"** task. There you can also specify an optional test filter.

#### Using command line

You can run tests using command line along with an optional `MOCHA_GREP` environment variable to apply a grep filter on tests to run.

```shell
MOCHA_GREP="Participant .* prompt builders" npm test
```

It may be quicker to be more specific and use `npm run test-extension` or `npm run test-webview` after compiling.

### Using Proposed API

The vscode extension will occasionally need to use [proposed API](https://code.visualstudio.com/api/advanced-topics/using-proposed-api) that haven't been promoted to stable yet. To enable an API proposal, add it to the `enabledApiProposals` section in `package.json`, then run `cd src/vscode-dts && npx @vscode/dts dev` to install the type definitions for the API you want to enable.

**Note**: Using proposed API is only possible during local development and will prevent publishing the extension.

#### Code Tour

- `out` Compiled extension code
- `images` Icons, logos, etc.
- `snippets` Bundled Terraform Snippets
- `syntaxes` [Syntax highlighting](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide#injection-grammars) for MongoDB keywords
- `src/test/suite` Where tests live with '`*.test.ts`' files names
- `scripts` Project helper scripts

## Releases

The MongoDB VSCode extension is not released on a set schedule. A new version is released on demand or when there are some features ready to go live.

### Releasing

Releases are automated using github actions, and published to the VSCode marketplace using a Personal Access Token (PAT). For additional information and reading, VSCode has some great documentation on publishing extensions:
https://code.visualstudio.com/api/working-with-extensions/publishing-extension
https://code.visualstudio.com/api/working-with-extensions/continuous-integration

1. To kick off a release run the [Draft Release Github Action](https://github.com/mongodb-js/vscode/actions/workflows/draft-release.yaml), specifying the type of bump from the dropdown (patch, minor, major) or the exact new version. When a bump is selected, the version of the release being drafted is derived applying the selected bump the last released version.
1. The action runs tests, creates the `.vsix` artifact for the new release version and creates a draft GitHub release (tagging the HEAD of `main`), with the `.vsix` artifact attached. At this point you can look in https://github.com/mongodb-js/vscode/releases and see the draft release.
1. Now let's download the built `.vsix` artifact in the new [GitHub release draft](https://github.com/mongodb-js/vscode/releases) and ensure it works smoothly. https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix Manually test the new version using the testing matrix found here: https://docs.google.com/spreadsheets/d/1014WyX-WPMfZTj6qVyYDA1JowGCFNCOQGgEhIA0O0bs/edit#gid=0 Duplicate the testing template page and rename it the new release. Not every test needs to be performed before we release, however, the critical paths should be tested.
1. Update the [release notes](https://github.com/mongodb-js/vscode/releases) in GitHub, documenting user facing changes. Once you’re happy with the changes you can publish the release.
1. When the release is published, the GitHub action https://github.com/mongodb-js/vscode/blob/main/.github/workflows/publish-release.yaml is automatically run, which downloads the release artifact and then publishes it to the VSCode marketplace.
1. Nice! ✨ Now you can verify it all completed by visiting https://marketplace.visualstudio.com/items?itemName=mongodb.mongodb-vscode and seeing the new version is up. You also try installing it in VSCode :) ✨
1. Lastly, don't forget to post in slack, let all your friends know, and close the release ticket in jira if there is one.
