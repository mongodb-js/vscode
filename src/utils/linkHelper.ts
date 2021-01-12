import * as vscode from 'vscode';
import { createServer, Server } from 'http';

const TRUSTED_DOMAINS: Array<RegExp> = [
  /^.*mongodb\.com$/i
];

/**
 * Opens a link through an in-browser redirect from localhost
 * via a short-lived helper server.
 *
 * Inspired from the Azure sign-in experience in MS'
 * extesion: https://github.com/microsoft/vscode-azure-account/blob/1d948273b4233fc101251d588e677ceb158951ea/src/codeFlowLogin.ts
 *
 * @param {string} url the url to open
 * @param {number} [serverPort=3211] the port where the helper server should listen.
 *
 * @returns {Server} the helper Server instance
 */
export const openLink = (url: string, serverPort = 3211): Promise<Server> => new Promise((resolve, reject) => {
  const { scheme, authority } = vscode.Uri.parse(url);
  if (scheme !== 'https' || !TRUSTED_DOMAINS.find(regex => regex.test(authority))) {
    return reject(new Error('untrusted url'));
  }

  const server = createServer((request, response) => {
    response.writeHead(302, { location: url });
    response.end();
  });

  // This works well for the time being but it should be changed
  // once we introduce a login with Atlas functionality. When that
  // will happen, then the server needs to stay alive until we get
  // the callback from Atlas.
  server.on('connection', () => {
    setTimeout(() => {
      server.close();
    }, 2000);
  });

  server.on('error', (err) => {
    reject(err);
  });

  server.listen(serverPort, () => {
    vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.parse(`http://localhost:${serverPort}`)
    );
  });
});
