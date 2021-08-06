#! /usr/bin/env ts-node

import ora = require('ora');
import fs = require('fs');
import path = require('path');
import { resolve } from 'path';
import { config } from 'dotenv';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const ROOT_DIR = path.join(__dirname, '..');
const ui = ora('Generate constants keyfile').start();

config({ path: resolve(__dirname, '../.env') });

(async () => {
  if (process.env.SEGMENT_KEY) {
    await writeFile(
      `${ROOT_DIR}/constants.json`,
      JSON.stringify({ segmentKey: process.env.SEGMENT_KEY }, null, 2)
    );
    ui.succeed('Generated segment constants file');
  } else {
    throw new Error('The Segment key is missing in environment variables');
  }
})().catch((error) => {
  ui.fail(`Failed to generate segment constants file: ${error.message}`);
})
