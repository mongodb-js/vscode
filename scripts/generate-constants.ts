#! /usr/bin/env ts-node

import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { resolve } from 'path';
import { config } from 'dotenv';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const ROOT_DIR = path.join(__dirname, '..');
const ui = ora('Generate constants file').start();

config({ path: resolve(__dirname, '../.env') });

(async () => {
  await writeFile(
    `${ROOT_DIR}/constants.json`,
    JSON.stringify(
      {
        segmentKey: process.env.SEGMENT_KEY,
        docsChatbotBaseUri: process.env.MONGODB_DOCS_CHATBOT_BASE_URI,
      },
      null,
      2
    )
  );
  ui.succeed('The constants file has been generated');
})().catch((error) => {
  ui.fail(`Failed to generate constants file: ${error.message}`);
});
