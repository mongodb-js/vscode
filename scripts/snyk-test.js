const childProcess = require('child_process');
const path = require('path');
const { promises: fs } = require('fs');
const os = require('os');
const { promisify } = require('util');
const execFile = promisify(childProcess.execFile);

// On Windows, commands like pnpm/npx need the .cmd extension
const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

async function snykTest(cwd) {
  const tmpPath = path.join(os.tmpdir(), 'tempfile-' + Date.now());

  try {
    console.info(`testing ${cwd} ...`);
    await fs.mkdir(path.join(cwd, `node_modules`), { recursive: true });

    try {
      await execFile(
        pnpmCmd,
        [
          'exec',
          'snyk',
          'test',
          '--severity-threshold=low',
          '--dev',
          `--json-file-output=${tmpPath}`,
        ],
        { cwd, stdio: 'inherit', shell: isWindows },
      );
    } catch (err) {
      console.warn(err);
    }

    const res = JSON.parse(await fs.readFile(tmpPath));
    console.info(`testing ${cwd} done.`);
    return res;
  } catch (err) {
    console.error(`testing ${cwd} failed. ${err.message}`);
    throw err;
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
  const results = await snykTest(rootPath);

  if (!results) {
    console.error('Snyk test failed to produce results');
    process.exit(1);
  }

  await fs.writeFile(
    path.join(rootPath, `.sbom/snyk-test-result.json`),
    JSON.stringify(results, null, 2),
  );

  await execFile(
    npxCmd,
    [
      'snyk-to-html',
      '-i',
      path.join(rootPath, '.sbom/snyk-test-result.json'),
      '-o',
      path.join(rootPath, `.sbom/snyk-test-result.html`),
    ],
    { cwd: rootPath, shell: isWindows },
  );
}

main().catch((err) => {
  console.error('Snyk test failed:', err);
  process.exit(1);
});
