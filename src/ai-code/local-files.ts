import temp from 'temp';
import fs from 'fs';
import glob from 'glob';
import path from 'path';
import execa from 'execa';

import { MAX_INPUT_FILES } from './constants';
import type { FileDirectory } from './constants';

// Automatically track and cleanup files at exit.
temp.track();

export const defaultGitFolderName = 'project';

export type OutputFile = {
  fileName: string;
  text?: string;
  isRenamed?: boolean;
  isDeleted?: boolean;
  oldFileName?: string;
};

// export async function createTempFile(tempDirId: string) {
//   return await temp.open(tempDirId);
// }

export async function createTempDir(tempDirId: string) {
  return await temp.mkdir(tempDirId);
}

function getMatchPatternArray(matchPatterns?: string[] | string) {
  if (!matchPatterns) {
    return ['**/*.*'];
  } else if (typeof matchPatterns === 'string') {
    return [matchPatterns];
  }

  const matchPatternArray: string[] = [];
  for (const pattern of matchPatterns) {
    matchPatternArray.push(pattern);
  }

  return matchPatterns;
}

export async function getFileStructure({
  inputFolder,
  matchPatterns,
  ignorePatterns,
}: {
  inputFolder: string; // Path to the input folder.
  matchPatterns?: string[] | string;
  ignorePatterns?: string[] | string;
}): Promise<{
  fileStructure: FileDirectory;
  fileCount: number;
}> {
  try {
    // Ensure we can access the folder.
    await fs.promises.access(inputFolder, fs.constants.R_OK);
  } catch (err) {
    throw new Error(`Cannot access folder "${inputFolder}": ${err}`);
  }

  const matchPatternArray = getMatchPatternArray(matchPatterns);
  console.log('Match patterns:');
  for (const pattern of matchPatternArray) {
    console.log(pattern);
  }

  const fileStructure: FileDirectory = {};
  const uniqueFileNames = new Set<string>();
  for (const pattern of matchPatternArray) {
    // We could parallelize this for large code bases.
    const globbedFiles = await glob(path.join(inputFolder, pattern), {
      ignore: ignorePatterns,
    });

    for (const fileName of globbedFiles) {
      // We remove the input folder so that the ai has less tokens it needs to parse and create.
      const relativeFileName = fileName.substring(inputFolder.length + 1);
      const fileParts = relativeFileName.split('/');
      const lastFileName = fileParts.pop() as string;

      if (lastFileName.startsWith('.')) {
        // Remove . files. (Maybe we'll want this removed later).
        continue;
      }

      uniqueFileNames.add(relativeFileName);

      let relativeFolder = fileStructure;
      for (const part of fileParts) {
        if (!relativeFolder[part]) {
          relativeFolder[part] = {};
        }
        relativeFolder = relativeFolder[part] as FileDirectory;
      }
      relativeFolder[lastFileName] = relativeFileName;
    }
  }

  console.log('\nInput files:');
  console.log(JSON.stringify(fileStructure, null, 2));

  return {
    fileStructure,
    fileCount: uniqueFileNames.size,
  };
}

export async function updateFiles({
  workingDirectory,
  outputFiles,
}: {
  workingDirectory: string;
  outputFiles: OutputFile[];
}) {
  if (outputFiles.length > MAX_INPUT_FILES * 2) {
    console.log('outputFiles', outputFiles);
    throw new Error(`Too many output files: ${outputFiles.length}`);
  }

  console.log('\nOutput files:');
  for (const outputFile of outputFiles) {
    const fileName = outputFile.fileName;
    console.log(outputFile);

    const fullFileName = path.join(workingDirectory, fileName);

    if (outputFile.isDeleted) {
      try {
        // Ensure it exists.
        await fs.promises.access(fullFileName, fs.constants.R_OK);
        await fs.promises.rm(fullFileName);
      } catch (err) {
        // Doesn't exist or can't delete.
      }
      continue;
    }

    const outputDirectory = path.dirname(fullFileName);
    try {
      // See if the folder already exists.
      await fs.promises.access(outputDirectory, fs.constants.R_OK);
    } catch (err) {
      // Make the folder incase it doesn't exist. If this fails something else is wrong.
      await fs.promises.mkdir(outputDirectory, { recursive: true });
    }

    // TODO: Parallelize.
    await fs.promises.writeFile(fullFileName, outputFile.text as string);

    if (outputFile.isRenamed) {
      const oldFileToDelete = path.join(
        workingDirectory,
        outputFile.oldFileName as string
      );
      try {
        // Ensure it exists.
        await fs.promises.access(oldFileToDelete, fs.constants.R_OK);
        await fs.promises.rm(oldFileToDelete);
      } catch (err) {
        // Doesn't exist or can't delete.
      }
    }
  }
}

export async function cloneAndAnalyzeCodebase({
  githubLink,
  useGithubLink,
}: {
  githubLink: string;
  useGithubLink: boolean;
}) {
  // 1. Ensure the codebase to load exists.
  if (useGithubLink) {
    // TODO: Make sure the url valid.
  } else {
    // Local files.
    // TODO: Ensure we can read them? or do that later when copying.
    throw new Error('not yet supported');
  }

  const operationId = `ai-code-${Date.now()}`; // TODO: uuid or something.

  // 2. Create temp directory to copy things to.
  const workingDirectory = await createTempDir(operationId);

  const gitFolder = path.join(workingDirectory, defaultGitFolderName);

  console.log('Created temp workingDirectory: ', workingDirectory);

  // 3. Copy/clone the codebase into the directory.
  if (useGithubLink) {
    console.log('Cloning the github repo...');
    // const { stdout }
    const gitCloneResult = await execa(
      'git',
      ['clone', githubLink, defaultGitFolderName],
      {
        cwd: workingDirectory,
      }
    );

    console.log('git clone result', gitCloneResult.stdout);
    const checkoutBranchResult = await execa(
      'git',
      ['checkout', '-b', operationId],
      {
        cwd: gitFolder,
      }
    );
    console.log(
      'git checkout new branch (-b) stdout',
      checkoutBranchResult.stdout
    );
  } else {
    // TODO: Initiate github repo (if it isn't one already?)
    // Checkout a branch
  }

  console.log('Analyzing file structure...');

  // 4. Analyze the directory/file structure.
  const { fileStructure, fileCount } = await getFileStructure({
    inputFolder: gitFolder,
  });

  return {
    fileCount,
    fileStructure,
    workingDirectory,
  };
}

export async function getGitDiff(path: string) {
  // Stage the changes so we can get the diff of the added files.
  const gitAddResult = await execa('git', ['add', '.'], {
    cwd: path,
  });
  console.log('git add result', gitAddResult);

  const gitDiffResult = await execa(
    'git',
    // ['diff'],
    // --raw ? https://git-scm.com/docs/git-diff
    // git diff -U1
    ['diff', '-U1', '--staged'],
    {
      cwd: path,
    }
  );

  return gitDiffResult;
}
