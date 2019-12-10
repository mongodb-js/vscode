import * as vscode from 'vscode';
const registerCommands = () => {
  vscode.commands.registerCommand('mdb.connect', (...args) => {
    console.log('connect', args);
  });
};

export { registerCommands };
