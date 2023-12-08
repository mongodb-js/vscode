import fs from 'fs';
import path from 'path';

const version = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json')).toString()
).version;

const vsixFileName = path.resolve(
  __dirname,
  '..',
  `./mongodb-vscode-${version}.vsix`
);
const size = fs.statSync(vsixFileName).size;

const maxSize = 8 * 1000000; // 8 MB

if (size >= maxSize) {
  throw new Error(
    `vsix bundle too big expected max ${maxSize} bytes, got ${size}.`
  );
}

console.info(`vsix size ok: ${size} bytes.`);
