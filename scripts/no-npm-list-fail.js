'use strict';
// Monkey-patch child_process so that the `npm list` command run by
// `vsce package` does not fail.
const child_process = require('child_process');
const origExec = child_process.exec;
child_process.exec = (cmd, options, cb) => {
  if (
    cmd === 'npm list --production --parseable --depth=99999 --loglevel=error'
  ) {
    origExec(cmd, options, (err, stdout, stderr) => {
      cb(null, stdout, stderr);
    });
  } else {
    origExec(cmd, options, cb);
  }
};
