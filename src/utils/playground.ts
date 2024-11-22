import * as vscode from 'vscode';
import micromatch from 'micromatch';
import fs from 'fs';
import path from 'path';

import { createLogger } from '../logging';

const log = createLogger('playground utils');

export class FileStat implements vscode.FileStat {
  constructor(private fsStat: fs.Stats) {}

  get type(): vscode.FileType {
    if (this.fsStat.isFile()) {
      return vscode.FileType.File;
    }
    if (this.fsStat.isDirectory()) {
      return vscode.FileType.Directory;
    }
    if (this.fsStat.isSymbolicLink()) {
      return vscode.FileType.SymbolicLink;
    }

    return vscode.FileType.Unknown;
  }

  get isFile(): boolean | undefined {
    return this.fsStat.isFile();
  }

  get isDirectory(): boolean | undefined {
    return this.fsStat.isDirectory();
  }

  get isSymbolicLink(): boolean | undefined {
    return this.fsStat.isSymbolicLink();
  }

  get size(): number {
    return this.fsStat.size;
  }

  get ctime(): number {
    return this.fsStat.ctime.getTime();
  }

  get mtime(): number {
    return this.fsStat.mtime.getTime();
  }
}

const getFileNames = (filePath: string): Promise<string[]> => {
  return fs.promises.readdir(filePath);
};

const getStat = async (filePath: string): Promise<vscode.FileStat> => {
  return new FileStat(await stat(filePath));
};

const stat = (filePath: string): Promise<fs.Stats> => {
  return fs.promises.lstat(filePath);
};

export const isPlayground = (fileUri?: vscode.Uri): boolean => {
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

export const getSelectedText = (): string | undefined => {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return;
  }

  // Sort lines selected as the may be mis-ordered from alt+click.
  const sortedSelections = (editor.selections as Array<vscode.Selection>).sort(
    (a, b) => (a.start.line > b.start.line ? 1 : -1)
  );

  return sortedSelections
    .map((item) => editor.document.getText(item) || '')
    .join('\n');
};

export const getAllText = (): string => {
  return vscode.window.activeTextEditor?.document.getText().trim() || '';
};

export const getPlaygroundExtensionForTelemetry = (
  fileUri?: vscode.Uri
): string => {
  let fileType = 'other';

  if (fileUri?.fsPath.match(/\.(mongodb\.js)$/gi)) {
    fileType = 'mongodbjs';
  } else if (fileUri?.fsPath.match(/\.(mongodb)$/gi)) {
    fileType = 'mongodb';
  }

  return fileType;
};

export const getPlaygrounds = async ({
  fsPath,
  excludeFromPlaygroundsSearch,
}: {
  fsPath: string;
  excludeFromPlaygroundsSearch?: string[];
}): Promise<{ name: string; path: string }[]> => {
  const result: { name: string; path: string }[] = [];
  const fileNames = await getFileNames(fsPath);
  for (const fileName of fileNames) {
    try {
      const stat = await getStat(path.join(fsPath, fileName));
      const fileUri = vscode.Uri.file(path.join(fsPath, fileName));

      if (stat.type === vscode.FileType.File && isPlayground(fileUri)) {
        result.push({ name: fileName, path: fileUri.fsPath });
      } else if (
        stat.type === vscode.FileType.Directory &&
        (!excludeFromPlaygroundsSearch ||
          !micromatch.isMatch(fileName, excludeFromPlaygroundsSearch))
      ) {
        const playgrounds = await getPlaygrounds({
          fsPath: fileUri.fsPath,
          excludeFromPlaygroundsSearch,
        });
        result.push(...playgrounds);
      }
    } catch (error) {
      log.error(
        'Getting playgrounds recursively from the workspace failed',
        error
      );
    }
  }

  return result;
};
