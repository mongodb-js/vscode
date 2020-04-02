#! /usr/bin/env ts-node

import ora = require('ora');
import fs = require('fs');
import path = require('path');
import { resolve } from 'path';
import { config } from 'dotenv';

const { promisify } = require('util');
const writeFile = promisify(fs.writeFile);
const ROOT_DIR = path.join(__dirname, '..');

config({ path: resolve(__dirname, '../.env') });

(async () => {
  if (process.env.SEGMENT_KEY) {
    const ui = ora('Generate constants keyfile').start();
    await writeFile(
      `${ROOT_DIR}/constants.json`,
      JSON.stringify({ segmentKey: process.env.SEGMENT_KEY }, null, 2)
    );
    ui.succeed('Generated .constants.json');
  }
})();
