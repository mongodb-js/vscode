import * as vscode from 'vscode';
import micromatch from 'micromatch';
import * as fs from 'fs';
import * as path from 'path';

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
}

const getStat = async (filePath: string): Promise<vscode.FileStat> => {
  return new FileStat(await stat(filePath));
}

const stat = (filePath: string): Promise<fs.Stats> => {
  return fs.promises.stat(filePath);
}

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

  return fileNameParts.length > 1 && (extension === 'mongodb' || (extension === 'js' && secondaryExtension === 'mongodb'));
}

export const readDirectory = async (fsPath: string, excludeFromPlaygroundsSearch?: string[]): Promise<{ name: string, path: string }[]> => {
  const fileNames = await getFileNames(fsPath);
  const playgrounds: { name: string, path: string }[] = [];

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];

    try {
      const stat = await getStat(path.join(fsPath, fileName));
      const fileUri = vscode.Uri.file(path.join(fsPath, fileName));

      if (stat.type === vscode.FileType.File && isPlayground(fileUri)) {
        playgrounds.push({ name: fileName, path: fileUri.fsPath });
      } else if (
        (stat.type === vscode.FileType.Directory && !excludeFromPlaygroundsSearch) ||
        (stat.type === vscode.FileType.Directory && excludeFromPlaygroundsSearch && !micromatch.isMatch(fileName, excludeFromPlaygroundsSearch))
      ) {
        await readDirectory(fileUri.fsPath);
      }
    } catch (error) {
      /* */
    }
  }

  return playgrounds;
}
