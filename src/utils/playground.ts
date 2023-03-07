import * as vscode from 'vscode';

import { getFiles } from './filesystem';

export const isPlayground = (fileUri?: vscode.Uri) => {
  if (!fileUri) {
    return false;
  }

  const fileNameParts = fileUri.fsPath.split('.');

  if (fileNameParts.length < 2) {
    return false;
  }

  // The default playgrounds extension is `.mongodb.js`.
  const extension = fileNameParts[fileNameParts.length - 1];
  const secondaryExtension = fileNameParts[fileNameParts.length - 2];

  return (
    extension === 'mongodb' ||
    (extension === 'js' && secondaryExtension === 'mongodb')
  );
};

export const getPlaygrounds = ({
  fsPath,
  excludeFromPlaygroundsSearch,
}: {
  fsPath: string;
  excludeFromPlaygroundsSearch?: string[];
}): Promise<{ name: string; path: string }[]> => {
  return getFiles({
    fsPath,
    excludeFromPlaygroundsSearch,
    checkByType: isPlayground,
  });
};
