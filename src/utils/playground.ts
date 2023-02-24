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

  // Allow users to save playgrounds with `.mongodb` extension.
  if (fileNameParts.length === 2) {
    return fileNameParts[fileNameParts.length - 1] === 'mongodb';
  }

  // The default playgrounds extension is `.mongodb.js`.
  const extension = fileNameParts[fileNameParts.length - 1];
  const secondaryExtension = fileNameParts[fileNameParts.length - 2];

  return (
    fileNameParts.length > 1 &&
    (extension === 'mongodb' ||
      (extension === 'js' && secondaryExtension === 'mongodb'))
  );
};

export const getPlaygrounds = async (
  data
): Promise<{ name: string; path: string }[]> => {
  return getFiles({ ...data, checkByType: isPlayground });
};
