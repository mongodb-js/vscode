import fs = require('fs');
import path = require('path');

const STAGE_OPERATORS = require('mongodb-ace-autocompleter').STAGE_OPERATORS;
const config = require(path.resolve(__dirname, '../../package.json'));
const SNIPPETS_DIR = path.resolve(__dirname, '../../src/snippets/');

/**
 * Transforms `mongodb-ace-autocompleter` snippets
 * into the vscode snippets.
 *
 * @param {String} prefix - The stage operator.
 * @param {String} description - The stage description.
 * @param {String} snippet - The stage snippet.
 * @param {String} comment - The optional comment.
 *
 * @returns {String} - The vscode snippet.
 */
const snippetTemplate = (
  prefix: string,
  description: string,
  snippet: string,
  comment?: string
): { prefix: string; body: Array<string>; description: string } => {
  const find = /[$]/;
  const re = new RegExp(find, 'g');
  let body = snippet.split('\n');

  // The `mongodb-ace-autocompleter` stores the stage prefix separately
  // from the stage body. In vscode extension we want to autopopulate
  // the body together with the prefix.
  // We also need to escape the `$` symbol in prefix.
  body[0] = `\\${prefix}: ${body[0]}`;

  // The stage comments are also stored separately
  // and might contain the `$` symbol
  // that is being interpreted by vscode as variable name,
  // but the variable is not known.
  // The solution is to escape this symbol before building the stage body.
  body = comment
    ? [...comment.replace(re, '\\$').split('\n'), ...body]
    : [...body];

  return { prefix, body, description };
};

const snippets = STAGE_OPERATORS.reduce(
  (
    prev: any,
    curr: {
      label: string;
      name: string;
      description: string;
      snippet: string;
      comment?: string;
    }
  ) => {
    prev[`MongoDB Aggregations ${curr.name}`] = snippetTemplate(
      curr.label,
      curr.description,
      curr.snippet,
      curr.comment
    );
    return prev;
  },
  {}
);

// Create the `snippets` folder.
fs.mkdir(SNIPPETS_DIR, (mkdirError: any) => {
  if (!mkdirError || (mkdirError && mkdirError.code === 'EEXIST')) {
    // Create the `stage-autocompleter.json` file with the vscode snippets.
    fs.writeFile(
      `${SNIPPETS_DIR}/stage-autocompleter.json`,
      JSON.stringify(snippets, null, 2),
      'utf8',
      (writeFileError: Record<string, any> | null) => {
        if (writeFileError) {
          return console.log(
            'An error occured while writing to stage-autocompleter.json',
            writeFileError
          );
        }

        console.log(
          `${SNIPPETS_DIR}/stage-autocompleter.json file has been saved`
        );

        const readme = `Generated from mongodb-ace-autocompleter@${config.devDependencies['mongodb-ace-autocompleter']}`;

        // Create the `README.md` file to inform the user of the extension
        // that the `stage-autocompleter.json` is being generated automatically.
        // Any manual changes will be overwritten with the next compilation.
        fs.writeFile(
          `${SNIPPETS_DIR}/README.md`,
          readme,
          'utf8',
          (writeReadmeError: Record<string, any> | null) => {
            if (writeReadmeError) {
              return console.log(
                'An error occured while writing to README.md',
                writeReadmeError
              );
            }

            console.log(readme);
          }
        );
      }
    );
  } else {
    console.log(mkdirError);
  }
});
