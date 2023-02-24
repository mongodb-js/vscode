import * as vscode from 'vscode';

import { getFiles } from './filesystem';

export const isNotebook = (fileUri?: vscode.Uri) => {
  if (!fileUri) {
    return false;
  }

  const fileNameParts = fileUri.fsPath.split('.');

  if (fileNameParts.length < 2) {
    return false;
  }

  // Allow users to save playgrounds with `.mongodb` extension.
  if (fileNameParts.length === 2) {
    return fileNameParts[fileNameParts.length - 1] === 'mdbnb';
  }

  // The default playgrounds extension is `.mongodb.js`.
  const extension = fileNameParts[fileNameParts.length - 1];

  return fileNameParts.length > 1 && extension === 'mdbnb';
};

export const getNotebooks = async (
  data
): Promise<{ name: string; path: string }[]> => {
  return getFiles({ ...data, checkByType: isNotebook });
};
