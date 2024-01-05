#!/usr/bin/env node
/* eslint-disable */
'use strict';
const fs = require('fs/promises');
const path = require('path');
const fetch = require('node-fetch');

const filePath = path.join(__dirname, 'request-test.txt');
// fetch() a URL and ignore the response body
(async function () {
  // await fs.writeFile(filePath, process.argv[2]);
  console.log('Request received', process.argv[2]);
  (await fetch(process.argv[2])).body?.resume();
})().catch(async (err) => {
  console.log('Request errored', err.message);
  process.nextTick(() => {
    throw err;
  });
});
