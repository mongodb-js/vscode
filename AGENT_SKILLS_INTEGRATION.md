# Agent Skills Integration Tracker

This document tracks the implementation of MongoDB Agent Skills integration into the VS Code extension.
See the full integration plan in the [agent-skills repo](https://github.com/mongodb-js/agent-skills/blob/main/docs/VSCode%20Integration%20Plan.md).

---

## Repository Boundaries

### `agent-skills` repo (content & validation)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Author `mongodb-mcp-setup` skill | ✅ Done | Exists in `skills/mongodb-mcp-setup/`; frontmatter validated |
| 2 | Author `mongodb-query-generator` skill | ✅ Done | Exists in `skills/mongodb-query-generator/`; frontmatter validated |
| 3 | Author `mongodb-client-management` skill | ✅ Done | Connection pooling, driver config, error handling, lifecycle |
| 4 | Author `mongodb-data-modeling` skill | ✅ Done | Embedding vs referencing, schema patterns, anti-patterns |
| 5 | Author `mongodb-query-optimization` skill | ✅ Done | ESR rule, explain plans, index strategies, pipeline optimization |
| 6 | Author `mongodb-stream-processing` skill | ✅ Done | Change streams, resume tokens, event-driven patterns |
| 7 | Author `mongodb-search-ai` skill | ✅ Done | Atlas Search, vector search, RAG pipelines, hybrid search |
| 8 | Author `mongodb-transactions` skill | ✅ Done | Multi-doc transactions, read/write concerns, causal consistency |
| 9 | Skill validation CI workflow | ✅ Done | `.github/workflows/validate-skills.yml` + `.github/scripts/validate-skills.sh` |
| 10 | Publish as npm package (`@mongodb-js/agent-skills`) | ✅ Done | `package.json` created with name `@mongodb-js/agent-skills`, version `0.1.0`, `files: ["skills/"]` |
| 11 | Testing / evals harness | ✅ Done | `testing/mongodb-query-generator/` contains evals and workspace fixtures |

### `vscode` repo — this repo (distribution & integration)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add `chatSkills` contribution point to `package.json` | ✅ Done | All 8 skills registered under `contributes.chatSkills` |
| 2 | Bump `engines.vscode` to `^1.100.0` | ✅ Done | Already `^1.101.1` — no change needed |
| 3 | Add `mongodb.agentSkills.enabled` setting | ✅ Done | Added under `contributes.configuration.properties` |
| 4 | Build pipeline to bundle skills from `agent-skills` repo | ✅ Done | `@mongodb-js/agent-skills` added as dependency; `.vscodeignore` exception ensures skills are included in VSIX |
| 5 | Verify MCP co-registration | ✅ Done | MCP server auto-starts via `MCPController`; tools registered via `vscode.lm.registerMcpServerDefinitionProvider('mongodb', ...)`. Skills reference `mcp__mongodb__*` which Copilot resolves through the registered MCP server. |
| 6 | Add telemetry for skill usage | ✅ Done | `AgentSkillInvokedTelemetryEvent` and `AgentSkillCompletedTelemetryEvent` added to `telemetryEvents.ts`; convenience methods `trackAgentSkillInvoked()` and `trackAgentSkillCompleted()` added to `TelemetryService` |
| 7 | End-to-end testing | ✅ Done | Skill registration, file existence, and frontmatter validation tests added to `extension.test.ts` |

---

## Implementation Details

### 1. `chatSkills` Contribution Point

Add to `package.json` under `contributes`:

```json
{
  "contributes": {
    "chatSkills": [
      { "path": "./skills/mongodb-mcp-setup/SKILL.md" },
      { "path": "./skills/mongodb-query-generator/SKILL.md" },
      { "path": "./skills/mongodb-client-management/SKILL.md" },
      { "path": "./skills/mongodb-data-modeling/SKILL.md" },
      { "path": "./skills/mongodb-query-optimization/SKILL.md" },
      { "path": "./skills/mongodb-stream-processing/SKILL.md" },
      { "path": "./skills/mongodb-search-ai/SKILL.md" },
      { "path": "./skills/mongodb-transactions/SKILL.md" }
    ]
  }
}
```

### 2. Version Constraint

```json
{ "engines": { "vscode": "^1.100.0" } }
```

### 3. Optional Settings

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "mongodb.agentSkills.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable MongoDB Agent Skills for GitHub Copilot."
        }
      }
    }
  }
}
```

### 4. Build Pipeline — Bundling Skills

The `@mongodb-js/agent-skills` package is added as a regular dependency. The `chatSkills` paths point directly to `./node_modules/@mongodb-js/agent-skills/skills/<name>/SKILL.md`. A `.vscodeignore` exception (`!node_modules/@mongodb-js/agent-skills/**`) ensures these files are included in the packaged VSIX.

No custom copy script or build step is needed.

### 5. MCP Co-registration

The extension already bundles the MongoDB MCP Server. Requirements:
- The MCP server must be registered so `mcp__mongodb__*` tools are available to Copilot.
- Existing MCP configuration (connection string, Atlas credentials) must flow through.
- The `mongodb-mcp-setup` skill guides users through credential setup if not yet configured.

### 6. Telemetry

Instrument the following metrics:

| Metric | Description |
|--------|-------------|
| Skill name | Which skill was invoked |
| Completion | Whether the skill ran to completion or was halted |
| Client | Identify as `vscode` |
| Extension installed | Whether the user has the extension |
| Skills version | Version of the bundled Agent Skills package |

Additionally: hook into MCP server tool invocation events, adding a `source: "agent-skill"` property to distinguish skill-originated calls from direct tool calls.

### 7. What Is NOT Needed

- No `vscode.languages` providers — skills operate through Copilot chat, not language services.
- No completion providers — slash commands come automatically from `chatSkills`.
- No extension activation logic — skills are static `package.json` contributions.
- No new UI surfaces — skills live entirely within Copilot chat.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│               VS Code + Copilot                  │
│                                                  │
│  User prompt ──► Copilot ──► Skill Discovery     │
│                    │       (name + description)   │
│                    ▼                              │
│              Skill Loading (SKILL.md body)        │
│                    │                              │
│                    ▼                              │
│         Agent follows skill instructions          │
│                    │                              │
│                    ▼                              │
│         Calls MCP tools (mcp__mongodb__*)         │
│                    │                              │
│  ┌─────────────────┴──────────────────────┐      │
│  │      MongoDB MCP Server (npx)          │      │
│  │  collection-schema, find, aggregate,   │      │
│  │  collection-indexes, list-databases,   │      │
│  │  Atlas Admin API tools                 │      │
│  └─────────────────┬──────────────────────┘      │
│                    │                              │
└────────────────────┼──────────────────────────────┘
                     ▼
           MongoDB Atlas / Local DB
```

