---
name: configure-mongodb-mcp
description: Guide users through configuring key MongoDB MCP server options. Use this skill when a user wants to set up or modify their MongoDB MCP server configuration.
---

# MongoDB MCP Server Setup

This skill guides users through configuring the MongoDB MCP server for use with an agentic client.

## Overview

The MongoDB MCP Server is embedded within the VSCode extension. It uses the active connection the VSCode extension is connected to, but there are other configuration options that users may want to set up, such as:

- Atlas Service Account credentials for invoking Atlas tools (such as getting performance metrics or creating DB users)
- Whether the server exposes read-only or read-write tools to the agentic client
- Whether the MCP server starts automatically with the extension or requires manual startup

## Step 1. Determine User's Current Configuration

The first step is to determine the current configuration - the final config is the merged result from the user config and the workspace config. The user config is located at:

- `%APPDATA%\Code\User\settings.json` on Windows
- `~/Library/Application Support/Code/User/settings.json` on macOS
- `~/.config/Code/User/settings.json` on Linux

The workspace config is located at `.vscode/settings.json` within the current workspace.

The MCP configuration options are prefixed with `mdb.mcp` - for example, `mdb.mcp.apiClientId`. Settings in the workspace config take priority over the user config settings.

Additionally, review the environment variables for MCP server config - those variables should start with `MDB_MCP_` - for example, `MDB_MCP_API_CLIENT_ID`. Environment variables are not used for configuration, but if they are set, offer to migrate them into the settings file and confirm with the user before writing.

## Step 2. Guide User Through Configuration Options

The next step is to guide the user through the various configuration options. First, remind them that the VSCode extension and the Agent will share the connection, so if they need to connect to specific Atlas cluster, they can do it from the VSCode extension itself. For each option, provide a brief description and ask the user if they want to configure it. If they say yes, prompt them for the necessary information. Make sure to prompt the user if they want to update the user config or the workspace config.

### Atlas Service Account Credentials (`mdb.mcp.apiClientId` + `mdb.mcp.apiClientSecret`)

**Type:** `string` (both) | **Default:** `""` (disabled) | **Corresponding environment variables:** `MDB_MCP_API_CLIENT_ID`, `MDB_MCP_API_CLIENT_SECRET`

When both `mdb.mcp.apiClientId` and `mdb.mcp.apiClientSecret` are set, the MCP server authenticates against the Atlas Admin API and unlocks Atlas-specific tools — such as retrieving performance metrics, managing database users, listing clusters, and other Atlas administration operations.

**How to obtain credentials:**

Follow the official MongoDB MCP Server prerequisites guide: https://www.mongodb.com/docs/mcp-server/prerequisites/

Key steps:

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com) and open the organization where your clusters live.
2. Go to **Access Manager** → **Service Accounts** → **Create Service Account**.
3. Assign the Service Account the minimum required roles for the operations you intend to use (e.g. `Organization Read Only` for read-only Atlas tools).
4. After creation, copy the **Client ID**. Then generate a **Client Secret** — Atlas shows the secret only once, so save it immediately.
5. Add your IP address to the Service Account's **API Access List** (on the service account details page). Without this step all Atlas Admin API calls will fail with authentication errors even if the credentials are valid.

**How to set it up:**

Add both values to your settings file:

```json
"mdb.mcp.apiClientId": "<your-client-id>",
"mdb.mcp.apiClientSecret": "<your-client-secret>"
```

> **Security:** Never commit these values to version control. Store them in your user-level settings (`~/Library/Application Support/Code/User/settings.json` on macOS) rather than the workspace `.vscode/settings.json` to avoid accidentally exposing them. Don't ask the user for the precise values - instead, guide them through the process of obtaining the credentials from Atlas and instruct them to paste the values into their settings file themselves.

### `mdb.mcp.readOnly`

**Type:** `boolean` | **Default:** `true` | **Corresponding environment variable:** `MDB_MCP_READ_ONLY`

Controls whether the MCP server exposes write operations to the connected agent. When `true` (the default), only `read`, and `metadata` operation types are available — `create`, `update`, and `delete` operations are disabled. Set to `false` to allow the agent to perform write operations against the database.

**How to set it up:**

- To keep the server read-only (recommended for most use cases and production environments):
  ```json
  "mdb.mcp.readOnly": true
  ```
- To allow the agent to perform write operations:
  ```json
  "mdb.mcp.readOnly": false
  ```

> **Recommendation:** Keep `readOnly: true` in shared or production-facing workspace settings. Only disable it in workspace settings when you explicitly need the agent to write data, and use a workspace config rather than user-level config so the permission is project-scoped.

### `mdb.mcp.server`

**Type:** `string (enum)` | **Default:** `"prompt"` | **Corresponding environment variable:** none - this is a vscode-only setting

Controls whether the MongoDB MCP server starts automatically when the VS Code extension loads, or requires manual startup. The server connects to whichever connection is currently active in the MongoDB VS Code extension.

**Accepted values:**

| Value                 | Label               | Behavior                                                                                                         |
| --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `"prompt"`            | Ask                 | Asks the user on first use whether to enable automatic startup.                                                  |
| `"autoStartEnabled"`  | Auto Start Enabled  | The MCP server starts automatically when the extension loads.                                                    |
| `"autoStartDisabled"` | Auto Start Disabled | The MCP server does not start automatically; use the **MongoDB: Start MCP Server** command to start it manually. |

**How to set it up:**

```json
"mdb.mcp.server": "autoStartEnabled"
```

> **Tip:** `"autoStartEnabled"` is the most convenient option if you use the MongoDB MCP server regularly. Use `"autoStartDisabled"` if you only need the server occasionally and prefer to avoid it consuming resources on every VS Code launch.

## Step 3. Apply the Configuration

Once you know which settings the user wants to change, offer to apply them directly on their behalf.

> **Security reminder:** If `mdb.mcp.apiClientId` or `mdb.mcp.apiClientSecret` are being written, warn the user not to commit the file to version control if it is the workspace `.vscode/settings.json`. Suggest adding `.vscode/settings.json` to `.gitignore` if it isn't already.

### 3a. Offer to Edit the File Directly

Ask the user: _"Would you like me to update the settings file for you?"_

- If **yes**, determine the target file (user config or workspace config — refer to Step 1 for paths) and apply the changes by reading the file, merging the new values into the existing JSON, and writing it back. Do not overwrite unrelated settings.
- If **no**, skip to Step 3b.

When writing the file:

- Read the file first to get the current contents (create it if it doesn't exist).
- Add or update only the keys the user confirmed. For example:
  ```json
  {
    "mdb.mcp.apiClientId": "<client-id>",
    "mdb.mcp.apiClientSecret": "<client-secret>",
    "mdb.mcp.readOnly": false,
    "mdb.mcp.server": "autoStartEnabled"
  }
  ```
- Do not modify keys or values other than the ones the user confirmed. Preserve existing formatting.
- If there are duplicate keys with different values, prompt the user to choose which one to keep.
- After writing, instruct the user to replace the placeholder values with their actual credentials.

### 3b. Manual Instructions (if user declines direct edit)

If the user prefers to make the changes themselves, provide a ready-to-paste JSON snippet containing only the settings they want to configure, and tell them exactly which file to open:

- **User config** (applies to all workspaces):
  - Windows: `%APPDATA%\Code\User\settings.json`
  - macOS: `~/Library/Application Support/Code/User/settings.json`
  - Linux: `~/.config/Code/User/settings.json`
- **Workspace config** (applies only to the current project): `.vscode/settings.json`

Example snippet to paste inside the top-level `{}` of the chosen file:

```json
"mdb.mcp.apiClientId": "<client-id>",
"mdb.mcp.apiClientSecret": "<client-secret>",
"mdb.mcp.readOnly": false,
"mdb.mcp.server": "autoStartEnabled"
```

Remind them to reload the VS Code window (or restart the MCP server via **MongoDB: Start MCP Server**) for the changes to take effect.
