#! /usr/bin/env node

/**
 * Scans agent-skills/skills/ (git submodule) for SKILL.md files
 * and updates the `contributes.chatSkills` array in package.json automatically.
 *
 * Usage:
 *   node scripts/sync-agent-skills.ts          # update package.json in place
 *   node scripts/sync-agent-skills.ts --check  # exit 1 if package.json is out of date
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const SKILLS_DIR = path.join(
  ROOT_DIR,
  'agent-skills',
  'skills',
);

const CHECK_MODE = process.argv.includes('--check');

function discoverSkills(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.warn(
      `⚠  Skills directory not found at ${SKILLS_DIR}. Is the agent-skills submodule initialised?`,
    );
    return [];
  }

  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      const skillMd = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      return fs.existsSync(skillMd);
    })
    .map((entry) => entry.name)
    .sort();
}

function buildChatSkills(
  skillNames: string[],
): Array<{ path: string }> {
  return skillNames.map((name) => ({
    path: `./agent-skills/skills/${name}/SKILL.md`,
  }));
}

(async () => {
  const skillNames = discoverSkills();

  if (skillNames.length === 0) {
    console.log('No skills found — chatSkills will be set to an empty array.');
  } else {
    console.log(`Found ${skillNames.length} skill(s): ${skillNames.join(', ')}`);
  }

  const packageJsonRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);

  const newChatSkills = buildChatSkills(skillNames);
  const currentChatSkills: unknown[] =
    packageJson.contributes?.chatSkills ?? [];

  const currentJson = JSON.stringify(currentChatSkills);
  const newJson = JSON.stringify(newChatSkills);

  if (currentJson === newJson) {
    console.log('✔  chatSkills in package.json is already up to date.');
    process.exit(0);
  }

  if (CHECK_MODE) {
    console.error(
      '✖  chatSkills in package.json is out of date. Run `pnpm sync-skills` to fix.',
    );
    process.exit(1);
  }

  // Update in place
  packageJson.contributes.chatSkills = newChatSkills;

  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf8',
  );

  console.log(
    `✔  Updated chatSkills in package.json (${currentChatSkills.length} → ${newChatSkills.length} skills).`,
  );
})().catch((error) => {
  console.error(`Failed to sync agent skills: ${error.message}`);
  process.exit(1);
});

