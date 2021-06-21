'use strict';
// Monkey-patch child_process so that the `npm list` command run by
// `vsce package` does not fail because of `mongodb` being a 4.x prerelease
// rather than a "proper" version number.
const child_process = require('child_process');
const origExec = child_process.exec;
child_process.exec = (cmd, options, cb) => {
  if (cmd === 'npm list --production --parseable --depth=99999 --loglevel=error') {
    origExec(cmd, options, (err, stdout, stderr) => {
      cb(null, stdout, stderr);
    });
  } else {
    origExec(cmd, options, cb);
  }
};

