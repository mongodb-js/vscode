#! /usr/bin/env ts-node

import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { resolve } from 'path';
import { config } from 'dotenv';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const ROOT_DIR = path.join(__dirname, '..');
const ui = ora('Generate constants keyfile').start();

config({ path: resolve(__dirname, '../.env') });

interface Constants {
  segmentKey?: string;
  useMongodbChatParticipant?: string;
  chatParticipantGenericPrompt?: string;
  chatParticipantQueryPrompt?: string;
  chatParticipantModel?: string;
}

const constants: Constants = {};

(async () => {
  if (process.env.SEGMENT_KEY) {
    constants.segmentKey = process.env.SEGMENT_KEY;
  }
  if (process.env.USE_MONGODB_CHAT_PARTICIPANT) {
    constants.useMongodbChatParticipant =
      process.env.USE_MONGODB_CHAT_PARTICIPANT;
  }
  if (process.env.CHAT_PARTICIPANT_GENERIC_PROMPT) {
    constants.chatParticipantGenericPrompt =
      process.env.CHAT_PARTICIPANT_GENERIC_PROMPT;
  }
  if (process.env.CHAT_PARTICIPANT_QUERY_PROMPT) {
    constants.chatParticipantQueryPrompt =
      process.env.CHAT_PARTICIPANT_QUERY_PROMPT;
  }
  if (process.env.CHAT_PARTICIPANT_MODEL) {
    constants.chatParticipantModel = process.env.CHAT_PARTICIPANT_MODEL;
  }
  if (Object.keys(constants).length === 0) {
    ui.warn('No constants to write');
    return;
  }

  await writeFile(
    `${ROOT_DIR}/constants.json`,
    JSON.stringify(constants, null, 2)
  );
  ui.succeed('The constants file was written');
})().catch((error) => {
  ui.fail(
    `An error occurred while writing the constants file: ${error.message}`
  );
});
