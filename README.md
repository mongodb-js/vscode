# MongoDB  for VS Code [Alpha]

[![Build Status](https://dev.azure.com/team-compass/team-compass/_apis/build/status/mongodb-js.vscode?branchName=master)](https://dev.azure.com/team-compass/team-compass/_build/latest?definitionId=4&branchName=master)

**MongoDB for VS Code** lets you easily work with MongoDB directly from your VS Code environment. Using the MongoDB Extension, you can:

* Connect to a MongoDB instance or cluster
* Navigate your databases and collections
* Prototype queries and aggregations


MongoDB for VS Code is still a work in progress and is **not yet released**.

## Installing the extension

MongoDB for VS Code can be installed in 2 ways.

You can clone this repository and install the extension in your VS Code with:

```shell
npm install
npm run local-install
```

This will compile and package MongoDB for VS Code into a `.vsix` file and add the extension to your VS Code.

Alternatively, you can download the prebuild `.vsix` package from the [releases page](https://github.com/mongodb-js/vscode/releases) and install it with the following command:

```shell
code --install-extension /path/to/mongodb-vscode-x.y.z.vsix
```

If you get an error because the `code` command is not found, you need to install it in your `$PATH`.
Open VS Code, launch the Commmand Palette (⌘+Shift+P on MacOS, Ctrl+Shift+P on Windows and Linux), type `code` and select "Install code command in $PATH".

## Features

### MongoDB data explorer
* Connect to your MongoDB instance, cluster or to your [Atlas deployment](https://www.mongodb.com/cloud/atlas/register)
* Navigate your database and collections
* See the documents in your collections
* Get a quick overview of your schema

![Explore data with MongoDB for VS Code](resources/screenshots/explore-data.png)

### MongoDB Playgrounds
* Prototype your queries, aggregations and MongoDB commands with MongoDB Syntax Highlighting
* Run your playgrounds and see the results instantly
* Save your playgrounds in your workspace and use them to document how your application interacts with MongoDB
* Build aggregations quickly with our helpful and well commented stage snippets

![Playgrounds](resources/screenshots/playground.png)


### Quick access to the MongoDB Shell
* Launch the MongoDB Shell from the command palette to quickly connect to the same cluster you have active in VS Code

![MongoDB Shell](resources/screenshots/shell-launcher.png)

## Extension Settings

* `mdb.shell`: The MongoDB shell to use.
* `mdb.show`: Show or hide the MongoDB view.
* `mdb.defaultLimit`: The number of documents to fetch when viewing documents from a collection.
* `mdb.connectionSaving.hideOptionToChooseWhereToSaveNewConnections`: When a connection is added, a prompt is shown that let's the user decide where the new connection should be saved. When this setting is checked, the prompt is not shown and the default connection saving location setting is used.
* `mdb.connectionSaving.defaultConnectionSavingLocation`: When the setting that hides the option to choose where to save new connections is checked, this setting sets if and where new connections are saved."

![Settings](resources/screenshots/settings.png)

## Telemetry

MongoDB for VS Code collects usage data and sends it to MongoDB to help improve our products and services. Read our [privacy policy](https://www.mongodb.com/legal/privacy-policy) to learn more. If you don’t wish to send usage data to MongoDB, you can opt out in the extension's settings.

## Contributing

For issues, please create a ticket in our [JIRA Project](https://jira.mongodb.org/browse/VSCODE).

For contributing, please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

Is there anything else you’d like to see in Compass? Let us know by submitting suggestions in our [feedback forum](https://feedback.mongodb.com).

## License

[Apache 2.0](./LICENSE.txt)
