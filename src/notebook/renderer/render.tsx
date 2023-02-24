import React from 'react';
import type { RendererContext, OutputItem } from 'vscode-notebook-renderer';

interface IRenderInfo {
  container: HTMLElement;
  outputItem: OutputItem;
  context: RendererContext<unknown>;
}

interface NotebookOutputProps {
  info: IRenderInfo;
}

export const NotebookOutput = ({ info }: NotebookOutputProps) => {
  // const json = JSON.parse(info.outputItem.text());
  const error = info.outputItem.json();
  // const color = new vscode.ThemeColor('editorError.foreground') || 'while';
  return (
    <div>
      <h1>Failed with error</h1>
      <p>{error.message}</p>
    </div>
  );
};
