import * as vscode from 'vscode';
import micromatch from 'micromatch';
import * as fs from 'fs';
import * as path from 'path';

import { createLogger } from '../logging';

const log = createLogger('file system util');

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

export const getFiles = async ({
  fsPath,
  excludeFromPlaygroundsSearch,
  checkByType,
}: {
  fsPath: string;
  excludeFromPlaygroundsSearch?: string[];
  checkByType: (uri: vscode.Uri) => boolean;
}): Promise<{ name: string; path: string }[]> => {
  const result: { name: string; path: string }[] = [];
  const fileNames = await getFileNames(fsPath);
  for (const fileName of fileNames) {
    try {
      const stat = await getStat(path.join(fsPath, fileName));
      const fileUri = vscode.Uri.file(path.join(fsPath, fileName));

      if (stat.type === vscode.FileType.File && checkByType(fileUri)) {
        result.push({ name: fileName, path: fileUri.fsPath });
      } else if (
        stat.type === vscode.FileType.Directory &&
        (!excludeFromPlaygroundsSearch ||
          !micromatch.isMatch(fileName, excludeFromPlaygroundsSearch))
      ) {
        const playgrounds = await getFiles({
          fsPath: fileUri.fsPath,
          excludeFromPlaygroundsSearch,
          checkByType,
        });
        result.push(...playgrounds);
      }
    } catch (error) {
      log.error('Get files recursively from the workspace failed', error);
    }
  }

  return result;
};
