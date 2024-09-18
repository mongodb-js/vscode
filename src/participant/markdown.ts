import * as vscode from 'vscode';

export function createMarkdownLink({
  commandId,
  data,
  name,
}: {
  commandId: string;
  data?:
    | {
        [field: string]: any;
      }
    | string;
  name: string;
}): vscode.MarkdownString {
  const encodedData = data
    ? encodeURIComponent(
        `["${
          typeof data === 'string'
            ? data
            : encodeURIComponent(JSON.stringify(data))
        }"]`
      )
    : undefined;
  const commandQueryString = data ? `?${encodedData}` : '';
  const link = new vscode.MarkdownString(
    `- <a href="command:${commandId}${commandQueryString}">${name}</a>\n`
  );
  link.supportHtml = true;
  link.isTrusted = { enabledCommands: [commandId] };
  return link;
}
