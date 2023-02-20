#! /usr/bin/env ts-node

import path from 'path';
import mkdirp from 'mkdirp';
import ora from 'ora';
import fs from 'fs';
import { promisify } from 'util';

import {
  ACCUMULATORS,
  CONVERSION_OPERATORS,
  EXPRESSION_OPERATORS,
  QUERY_OPERATORS,
  STAGE_OPERATORS,
} from '@mongodb-js/mongodb-constants';

const writeFile = promisify(fs.writeFile);
const SYNTAXES_DIR = path.join(__dirname, '..', 'syntaxes');

const mongodbeywords = [
  ...ACCUMULATORS,
  ...CONVERSION_OPERATORS,
  ...EXPRESSION_OPERATORS,
  ...QUERY_OPERATORS,
  ...STAGE_OPERATORS,
];

const injectionGrammar = {
  scopeName: 'mongodb.injection',
  injectionSelector: 'L:meta.objectliteral.js',
  patterns: [{ include: '#object-member' }],
  repository: {
    'object-member': {
      patterns: mongodbeywords.map((keyword) => ({
        name: 'meta.object.member.mongodb',
        match: `\\${keyword.name}\\b`,
        captures: {
          0: {
            name: `keyword.other.${keyword.name}.mongodb`,
          },
        },
      })),
    },
  },
};

(async () => {
  const ui = ora().start();
  ui.info('Creating the MongoDB injection grammar...');
  await mkdirp(SYNTAXES_DIR);
  ui.succeed(`The '${SYNTAXES_DIR}' folder has been created`);
  await writeFile(
    `${SYNTAXES_DIR}/mongodbInjection.tmLanguage.json`,
    JSON.stringify(injectionGrammar, null, 2)
  );
  ui.succeed('MongoDB injection grammar has been saved');
})();
