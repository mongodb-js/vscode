import * as vscode from 'vscode';

export function createMarkdownLink({
  commandId,
  data,
  name,
}: {
  commandId: string;
  // TODO: Create types for this data so we can also then use them on the extension
  // controller when we parse the result.
  data: {
    [field: string]: any;
  };
  name: string;
}): vscode.MarkdownString {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  const commandQueryString = data ? `?${encodedData}` : '';
  const link = new vscode.MarkdownString(
    `- <a href="command:${commandId}${commandQueryString}">${name}</a>\n`
  );
  link.supportHtml = true;
  link.isTrusted = { enabledCommands: [commandId] };
  return link;
}
