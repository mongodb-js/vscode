import * as vscode from 'vscode';

export function createMarkdownLink({
  commandId,
  data,
  name,
}: {
  commandId: string;
  // Currently, nothing checks that what we serialize here matches what the
  // command handler destructures on the other side of the URI.
  data: {
    [field: string]: any;
  };
  name: string;
}): vscode.MarkdownString {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  const link = new vscode.MarkdownString(
    `- [${name}](command:${commandId}?${encodedData})\n`,
  );
  link.isTrusted = { enabledCommands: [commandId] };
  return link;
}
