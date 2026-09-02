import * as vscode from 'vscode';
import { redactConnectionString } from 'mongodb-connection-string-url';

/**
 * Ask the user to confirm something we are about to do with a connection string,
 * showing them the whole connection string with its credentials removed so that they
 * can see the options it sets and not just the host they recognise.
 */
export const confirmConnection = async ({
  connectionString,
  question,
  action,
}: {
  connectionString: string;
  question: string;
  action: string;
}): Promise<boolean> => {
  const confirmed = await vscode.window.showWarningMessage(
    question,
    { modal: true, detail: redactConnectionString(connectionString) },
    action,
  );

  return confirmed === action;
};
