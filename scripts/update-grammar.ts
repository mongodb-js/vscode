#! /usr/bin/env ts-node

const path = require('path');
const download = require('download');
const ora = require('ora');
const meow = require('meow');
const mkdirp = require('mkdirp');

const DEFAULT_DEST = path.join(__dirname, '..', 'syntaxes');

const languageURL =
  'https://raw.githubusercontent.com/mongodb-js/vscode-mongodb-language/master/syntaxes/mongodb.tmLanguage.json';

const cli = meow(
  `
  Downloads the latest mongodb.tmLanguage.json from mongodb-js/vscode-mongodb-language

	Usage
	  $ update-grammar.ts

	Options
    --dest Directory to download to [Default: ${DEFAULT_DEST}]
    --src URL of mongodb.tmLanguage.json [Default: ${languageURL}]

	Examples
	  $ ./update-grammar.ts
	  ℹ Downlading latest mongodb.tmLanguage.json
    ✔ Downloaded to /Users/lucas/vsc/syntaxes/mongodb.tmLanguage.json
`,
  {
    flags: {
      dest: {
        default: DEFAULT_DEST
      },
      url: {
        default: languageURL
      }
    }
  }
);

(async () => {
  await mkdirp(DEFAULT_DEST);

  const ui = ora()
    .info('Downlading latest mongodb.tmLanguage.json')
    .start();
  try {
    await download(cli.flags.url, cli.flags.dest);
    ui.succeed(
      `Downloaded to ${path.join(cli.flags.dest, 'mongodb.tmLanguage.json')}`
    );
  } catch (err) {
    ui.fail(`Download failed: ${err.message}`);
  }
})();
