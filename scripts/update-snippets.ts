import path from 'path';
import mkdirp from 'mkdirp';
import ora from 'ora';
import fs from 'fs';
import { promisify } from 'util';
import { STAGE_OPERATORS } from '@mongodb-js/mongodb-constants';

const writeFile = promisify(fs.writeFile);
const SNIPPETS_DIR = path.join(__dirname, '..', 'snippets');

/**
 * Transforms stage operator metadata into the vscode snippets.
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

  // Stage operators store stage name separate from the stage body. In vscode
  // extension we want to autopopulate the body together with the prefix. We
  // also need to escape the `$` symbol in prefix.
  body[0] = `\\${prefix}: ${body[0]}`;

  // The stage comments are also stored separately
  // and might contain the `$` symbol
  // that is being interpreted by vscode as variable name,
  // but the variable is not known.
  // The solution is to escape this symbol before building the stage body.
  body = comment
    ? [...comment.trim().replace(re, '\\$').split('\n'), ...body]
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

(async () => {
  const ui = ora('Update snippets').start();

  ui.info(`Create the ${SNIPPETS_DIR} folder`);
  await mkdirp(SNIPPETS_DIR);
  await writeFile(
    `${SNIPPETS_DIR}/stage-autocompleter.json`,
    JSON.stringify(snippets, null, 2)
  );
  ui.succeed(`Updated ${SNIPPETS_DIR}/stage-autocompleter.json`);
})();
