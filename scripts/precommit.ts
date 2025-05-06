#! /usr/bin/env ts-node
/* eslint-disable no-console */

import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);

async function main(fileList: string[]) {
  if (fileList.length === 0) {
    console.log('No files to re-format. Skipping ...');
    return;
  }

  console.log('Re-formatting following files ...');
  fileList.map((filePath) => {
    console.log(`  - ${path.relative(process.cwd(), filePath)}`);
  });

  await execFileAsync('npx', [
    'prettier',
    '--config',
    require.resolve('@mongodb-js/prettier-config-devtools/.prettierrc.json'),
    // Silently ignore files that are of format that is not supported by prettier.
    '--ignore-unknown',
    '--write',
    ...fileList,
  ]);

  // Re-add potentially reformatted files.
  await execFileAsync('git', ['add', ...fileList]);
}

const fileList = process.argv
  .slice(
    process.argv.findIndex((filename) => filename.includes('precommit')) + 1,
  )
  .filter((arg) => !arg.startsWith('-'))
  .map((filePath) => {
    return path.resolve(process.cwd(), filePath);
  });

main(fileList).catch((err) =>
  process.nextTick(() => {
    throw err;
  }),
);
