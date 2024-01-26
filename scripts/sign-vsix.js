const { sign } = require('@mongodb-js/signing-utils');

(async () => {
  const file = process.argv[2];
  if (!file) {
    throw new Error('File is required.');
  }
  console.log(`Signing vsix: ${file}`);
  await sign(file, {
    client: 'local',
    signingMethod: 'gpg',
  });
})();
