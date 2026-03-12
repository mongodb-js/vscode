/**
 * sync-skills.ts
 *
 * Syncs agent skills from the ext/agent-skills/skills submodule.
 *
 * This script:
 * 1. Reads all skill directories from ext/agent-skills/skills (excluding mongodb-mcp-setup)
 * 2. Reads all local skill directories from ./skills
 * 3. Updates package.json contributes.chatSkills with the corresponding paths
 *
 * Usage:
 *   node scripts/sync-skills.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const AGENT_SKILLS_DIR = path.join(rootDir, 'ext', 'agent-skills', 'skills');
const LOCAL_SKILLS_DIR = path.join(rootDir, 'skills');
const PACKAGE_JSON_PATH = path.join(rootDir, 'package.json');
const EXCLUDED_SKILLS = ['mongodb-mcp-setup'];

interface ChatSkill {
  path: string;
}

/**
 * Get all skill directories from the agent-skills submodule
 */
function getAgentSkills(): string[] {
  if (!fs.existsSync(AGENT_SKILLS_DIR)) {
    console.error(`Agent skills directory not found: ${AGENT_SKILLS_DIR}`);
    return [];
  }

  const entries = fs.readdirSync(AGENT_SKILLS_DIR, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !EXCLUDED_SKILLS.includes(name));
}

/**
 * Get all local skill directories from the skills folder
 */
function getLocalSkills(): string[] {
  if (!fs.existsSync(LOCAL_SKILLS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(LOCAL_SKILLS_DIR, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Update package.json with chatSkills entries
 */
function updatePackageJson(agentSkills: string[], localSkills: string[]): void {
  const packageJsonContent = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const packageJson: {
    contributes: {
      chatSkills: ChatSkill[];
    };
  } = JSON.parse(packageJsonContent);

  // Recreate chatSkills array with proper paths for each type
  packageJson.contributes.chatSkills = [
    ...agentSkills.map(
      (name): ChatSkill => ({
        path: `./ext/agent-skills/skills/${name}/SKILL.md`,
      }),
    ),
    ...localSkills.map(
      (name): ChatSkill => ({
        path: `./skills/${name}/SKILL.md`,
      }),
    ),
  ];

  const totalSkills = agentSkills.length + localSkills.length;
  console.log(`✓ Updated package.json with ${totalSkills} skills`);

  // Write back with proper formatting
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8',
  );
}

/**
 * Main function
 */
function main(): void {
  console.log('🔄 Syncing agent skills...\n');

  const agentSkills = getAgentSkills();
  const localSkills = getLocalSkills();

  if (agentSkills.length > 0) {
    console.log(
      `Found ${agentSkills.length} agent skills:\n  - ${agentSkills.join('\n  - ')}\n`,
    );
  }

  if (localSkills.length > 0) {
    console.log(
      `Found ${localSkills.length} local skills:\n  - ${localSkills.join('\n  - ')}\n`,
    );
  }

  if (agentSkills.length === 0 && localSkills.length === 0) {
    console.log('⚠ No skills found');
    return;
  }

  console.log('Updating package.json...');
  updatePackageJson(agentSkills, localSkills);

  console.log('\n✅ Skills sync complete!');
}

main();
