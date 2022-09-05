const download = require('download');
const semver = require('semver');
const { cli } = require('cli-ux');
const chalk = require('chalk');
const execa = require('execa');
const yargsParser = require('yargs-parser');

const REPO = 'mongodb-js/vscode';
const GET_LAST_RELEASE_API_ENDPOINT = `https://api.github.com/repos/${REPO}/releases/latest`;
const USAGE = `Usage: start-release *.*.*|major|minor|patch`;

function fail(...error) {
  cli.info(chalk.red('Error:'), ...error);
  process.exit(1);
}

async function isDirty() {
  const { stdout } = await execa('git', ['status', '--porcelain']);
  return stdout.toString().trim().length > 0;
}

async function getCurrentBranch() {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return stdout.toString().trim();
}

async function revParse(ref) {
  const { stdout } = await execa('git', ['rev-parse', ref]);
  return stdout.toString().trim();
}

async function tag(name) {
  await execa('git', ['tag', '-a', name, '-m', name]);
}

async function pushTags() {
  await execa('git', ['push', '--tags']);
}

async function main() {
  const args = yargsParser(process.argv.slice(2));

  if ((await getCurrentBranch()) !== 'main') {
    fail('You can only run this script from the main branch');
  }

  if (await isDirty()) {
    fail('You have untracked or staged changes.');
  }

  if (
    !args.skipCheckHead &&
    (await revParse('HEAD')) !== (await revParse('origin/HEAD'))
  ) {
    fail(
      'The current commit is not up to date with origin/HEAD.' +
        ' Rerun this script with --skipCheckHead to suppress this check'
    );
  }

  if (args._.length !== 1) {
    fail(USAGE);
  }

  const versionOrBumpType = args._[0];

  const lastReleaseVersion = await getLastReleaseVersion();

  if (['major', 'minor', 'patch'].includes(versionOrBumpType)) {
    return await startRelease(
      semver.inc(lastReleaseVersion, versionOrBumpType)
    );
  }

  if (
    semver.valid(versionOrBumpType) &&
    !semver.prerelease(versionOrBumpType)
  ) {
    return await startRelease(new semver.SemVer(versionOrBumpType).version);
  }

  fail(USAGE);
}

async function getLastReleaseVersion() {
  const body = await download(GET_LAST_RELEASE_API_ENDPOINT);
  const release = JSON.parse(body.toString());
  const semverVersion = new semver.SemVer(release.tag_name);
  return semverVersion.version;
}

async function startRelease(version) {
  const answer = await cli.confirm(
    `Are you sure you want to create the release ${chalk.bold(version)}?`
  );
  if (!answer) {
    return;
  }

  cli.action.start('tagging the current commit');
  await tag(`v${version}`);
  cli.action.stop();

  cli.action.start('pushing tags');
  await pushTags();
  cli.action.stop();

  cli.info(`
${chalk.green('Done!')}

A release draft will be created at https://github.com/${REPO}/releases

You can follow the build at https://github.com/${REPO}/actions/workflows/test-and-build.yaml
`);
}

main();
