const childProcess = require('child_process');
const path = require('path');
const { promises: fs } = require('fs');
const os = require('os');
const { promisify } = require('util');
const execFile = promisify(childProcess.execFile);

async function snykTest(cwd) {
  const tmpPath = path.join(os.tmpdir(), 'tempfile-' + Date.now());

  try {
    console.info(`testing ${cwd} ...`);
    await fs.mkdir(path.join(cwd, `node_modules`), { recursive: true });

    try {
      await execFile(
        'pnpm',
        [
          'exec',
          'snyk',
          'test',
          '--severity-threshold=low',
          '--dev',
          `--json-file-output=${tmpPath}`,
        ],
        // Do not print anything to the console.
        { cwd, stdio: 'ignore' },
      );
    } catch (err) {
      throw new Error(
        `Snyk test failed to produce results for ${cwd}. Check the report for details.`,
      );
    }

    const res = JSON.parse(await fs.readFile(tmpPath));
    console.info(`Testing ${cwd} completed.`);
    return res;
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

main().catch((err) => {
  console.error('Snyk Test Failed:', err.message);
  process.exit(1);
});
