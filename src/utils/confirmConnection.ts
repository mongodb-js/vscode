import * as vscode from 'vscode';
import ConnectionString, {
  redactConnectionString,
} from 'mongodb-connection-string-url';
import { checkConnectionStringPolicy } from '@mongodb-js/connection-string-policy';

/**
 * A connection string is a single unbroken token, and the native dialog VS Code
 * uses for modals on Windows ellipsizes those instead of wrapping them, hiding
 * exactly the options we want the user to look at. Breaking it over lines gives
 * the dialog somewhere to wrap.
 */
export const formatConnectionStringForDisplay = (
  connectionString: string,
): string => {
  // Redact before taking it apart, so that redactConnectionString stays the only
  // thing that decides which parts of a connection string hold secrets.
  const redacted = redactConnectionString(connectionString);

  let url: ConnectionString;
  try {
    url = new ConnectionString(redacted);
  } catch {
    return redacted;
  }

  const credentials = url.username || url.password ? '<credentials>@' : '';
  const pathname = url.pathname === '/' ? '' : url.pathname;
  const hosts = `${url.hosts.join(',\n')}${pathname}`;
  // No indentation: the dialog renders the detail as HTML and collapses it.
  const lines = [
    // The scheme only earns a line of its own when it is followed by credentials.
    ...(credentials
      ? [`${url.protocol}//${credentials}`, hosts]
      : [`${url.protocol}//${hosts}`]),
    ...[...url.searchParams.entries()].map(
      ([key, value], index) => `${index === 0 ? '?' : '&'}${key}=${value}`,
    ),
  ];

  return lines.join('\n');
};

/**
 * Ask the user to confirm something we are about to do with a connection string,
 * showing them the whole connection string with its credentials removed so that they
 * can see the options it sets and not just the host they recognise. Options that are
 * outside of the shared connection string policy are called out, because those are the
 * ones worth refusing over.
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
  const { withinPolicy, flaggedOptions } =
    checkConnectionStringPolicy(connectionString);

  const detail = [
    formatConnectionStringForDisplay(connectionString),
    ...(withinPolicy
      ? []
      : [
          '',
          'Warning: these options may put your credentials or data at risk:',
          flaggedOptions.join(', '),
        ]),
  ].join('\n');

  const confirmed = await vscode.window.showWarningMessage(
    question,
    { modal: true, detail },
    action,
  );

  return confirmed === action;
};
