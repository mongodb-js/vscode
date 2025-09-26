const childProcess = require('child_process');
const path = require('path');
const { promises: fs } = require('fs');
const os = require('os');
const { glob } = require('glob');
const { promisify } = require('util');
const execFile = promisify(childProcess.execFile);

const PACKAGE_LOCK_PATH = path.join(__dirname, '..', 'package-lock.json');

/**
 * "node_modules/@vscode/vsce-sign" package which is a dev dependency used for
 * publishing extension declares platform specific optionalDependencies, namely
 * the following:
 * - "@vscode/vsce-sign-alpine-arm64"
 * - "@vscode/vsce-sign-alpine-x64"
 * - "@vscode/vsce-sign-darwin-arm64"
 * - "@vscode/vsce-sign-darwin-x64"
 * - "@vscode/vsce-sign-linux-arm"
 * - "@vscode/vsce-sign-linux-arm64"
 * - "@vscode/vsce-sign-linux-x64"
 * - "@vscode/vsce-sign-win32-arm64"
 * - "@vscode/vsce-sign-win32-x64"
 *
 * Snyk requires what is declared in package-lock.json to be also present in
 * installed node_modules but this will never happen because for any platform,
 * other platform specific deps will always be missing which means Snyk will
 * always fail in this case.
 *
 * Because we always install with `npm ci --omit=optional`, with this method we
 * try to remove these identified problematic optionalDependencies before
 * running the Snyk tests and once the tests are finished, we restore the
 * original state back using npm hooks.
 */
async function removeProblematicOptionalDepsFromPackageLock() {
  const packageLockContent = JSON.parse(
    await fs.readFile(PACKAGE_LOCK_PATH, 'utf-8'),
  );

  const vsceSignPackage =
    packageLockContent.packages?.['node_modules/@vscode/vsce-sign'];

  if (!vsceSignPackage || !vsceSignPackage.optionalDependencies) {
    console.info('No problematic optional dependencies to fix');
    return;
  }

  // Temporarily remove the optional dependencies
  vsceSignPackage['optionalDependencies'] = {};

  // We write the actual package-lock path but restoring of the original file is
  // handled by npm hooks.
  await fs.writeFile(
    PACKAGE_LOCK_PATH,
    JSON.stringify(packageLockContent, null, 2),
  );
}

async function snykTest(cwd) {
  const tmpPath = path.join(os.tmpdir(), 'tempfile-' + Date.now());

  try {
    console.info(`testing ${cwd} ...`);
    await fs.mkdir(path.join(cwd, `node_modules`), { recursive: true });

    try {
      await execFile(
        'npx',
        [
          'snyk@latest',
          'test',
          '--severity-threshold=low',
          '--dev',
          `--json-file-output=${tmpPath}`,
        ],
        { cwd, stdio: 'inherit' },
      );
    } catch (err) {
      console.warn(err);
    }

    const res = JSON.parse(await fs.readFile(tmpPath));
    console.info(`testing ${cwd} done.`);
    return res;
  } catch (err) {
    console.error(`testing ${cwd} failed. ${err.message}`);
  } finally {
    try {
      await fs.rm(tmpPath);
    } catch (error) {
      //
    }
  }
}

async function main() {
  const rootPath = path.resolve(__dirname, '..');
  await fs.mkdir(path.join(rootPath, `.sbom`), { recursive: true });
  await removeProblematicOptionalDepsFromPackageLock();
  const results = await snykTest(rootPath);

  await fs.writeFile(
    path.join(rootPath, `.sbom/snyk-test-result.json`),
    JSON.stringify(results, null, 2),
  );

  await execFile(
    'npx',
    [
      'snyk-to-html',
      '-i',
      path.join(rootPath, '.sbom/snyk-test-result.json'),
      '-o',
      path.join(rootPath, `.sbom/snyk-test-result.html`),
    ],
    { cwd: rootPath },
  );
}

main();
