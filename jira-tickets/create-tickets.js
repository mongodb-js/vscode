// Creates the VSCODE-828 e2e tickets via the Jira REST API.
// Browser: open Jira while logged in, paste this into the DevTools console. It does a dry run;
//   then run `await createTickets({ dryRun: false })`.
// Node 18+: JIRA_URL=https://jira.mongodb.org JIRA_TOKEN=<personal access token> node create-tickets.js [--create]

const PROJECT = 'VSCODE';
const EPIC = "VSCODE-828";
const TICKETS = [
  {
    "summary": "Refactor e2e tests to use shared Playwright fixtures and page objects",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "refactor"
    ],
    "description": "Every spec in src/test/e2e repeats the same beforeAll/afterEach/afterAll (start mongod, launch VS Code, wait for ready, screenshot on failure, copy logs, teardown). Failure screenshots are attached to the report in some files and not others. Tree row locators, the connected-state regex, and the overview webview frame chain are duplicated across specs. Do this before adding the new suites so they start from a clean base.\n\n*Scope:*\n* Worker-scoped fixtures for mongod and the VS Code app; test-scoped page with automatic failure screenshot attachment and log copy.\n* Page objects/helpers for the connection tree (row, connected state, expand, context menu), overview webview, connection form, and playground.\n* Make mongod topology and port configurable so replica set and Docker-backed suites can reuse the fixtures.\n* Remove silent .catch(() => {}) calls that can hide real failures.\n\n*Notes:*\n* AC: existing tests pass on Linux, macOS, and Windows; a new spec needs no setup boilerplate."
  },
  {
    "summary": "Run e2e tests in a dedicated CI job with tag-based filtering",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "ci"
    ],
    "description": "pnpm run test runs e2e, webview, and extension tests in a single step per OS, so an e2e failure hides the other results and the job is slow to rerun.\n\n*Scope:*\n* Split e2e into its own job (ubuntu, windows, macos) in test-and-build.yaml and test-and-build-from-fork.yaml, keeping the artifact upload.\n* Introduce Playwright tags (e.g. @docker, @atlas) so environment-dependent suites are skipped where the environment is unavailable.\n* Decide on CI retries and flaky-test reporting (currently retries: 0).\n* Document running a single suite or tag locally in CONTRIBUTING.md."
  },
  {
    "summary": "Run e2e tests against VS Code Stable in addition to Insiders",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e",
      "ci"
    ],
    "description": "globalSetup and launchVSCode only download Insiders, while most users and the manual release pass use Stable. Add Stable as a Playwright project or CI matrix dimension (Stable on every PR, Insiders nightly is one option)."
  },
  {
    "summary": "Add Docker-based SSH and TLS environments for e2e tests",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "infra"
    ],
    "description": "Several critical-path matrix rows need SSH and TLS servers. Use mongodb-js/devtools-docker-test-envs (as Compass does) to provide them.\n\n*Scope:*\n* Helpers to start/stop the SSH (password and identity file) and TLS (CA, client certificate) compose environments and expose their hosts, credentials, and cert paths.\n* Run on Linux CI runners only (GitHub macOS/Windows runners cannot run Linux containers); tag the suites @docker so they skip elsewhere.\n\n*Notes:*\n* Blocks the SSH and TLS ticket(s)."
  },
  {
    "summary": "Add e2e tests for connecting to an Atlas SRV cluster",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Cover connecting to a mongodb+srv cluster with the Compass test dataset.\n\n*Testing matrix rows:*\n* Connection String > Connect to Compass dataset (srv)\n* Connection Form > Connect to Compass dataset (srv)\n* Saved connection > Connect to Compass dataset (srv)\n* Launch Shell > Connect to Compass dataset (srv)\n\n*Scope:*\n* Store a read-only SRV connection string as a CI secret; skip (@atlas) when it is absent, e.g. on fork PRs.\n* Connect via connection string and via the form, verify databases load, reconnect after reload, and assert launch shell receives the mongodb+srv string."
  },
  {
    "summary": "Add e2e test for connecting to a replica set via the connection form multi-host input",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e"
    ],
    "description": "Start a replica set with mongodb-runner (no Docker needed), add each host in the form, connect, and verify data is visible.\n\n*Testing matrix rows:*\n* Connection Form > Connect to replica set (using multi-host/port input)"
  },
  {
    "summary": "Add e2e tests for SSH connections",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Connect through an SSH tunnel using password and identity file auth.\n\n*Testing matrix rows:*\n* Connection Form > Connect via SSH\n* Saved connection > Connect via SSH\n* Tree View > Can copy a connection's SSH connection string\n\n*Notes:*\n* Depends on the Docker SSH/TLS environments ticket."
  },
  {
    "summary": "Add e2e tests for playgrounds and launch shell over SSH",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Run a playground, check autocompletion, and launch the shell against an SSH-tunnelled connection.\n\n*Testing matrix rows:*\n* Playgrounds > Can run a playground against the SSH connection\n* Playgrounds > Completion works in playground via SSH connection\n* Launch Shell > Connect via SSH\n\n*Notes:*\n* Depends on the Docker SSH/TLS environments and SSH connection tickets."
  },
  {
    "summary": "Add e2e tests for TLS/SSL connections",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Connect with TLS (CA file and client certificate), then run a playground and launch the shell against that connection.\n\n*Testing matrix rows:*\n* Connection Form > Connect via SSL\n* Saved connection > Connect via SSL\n* Playgrounds > Can run a playground against a TLS/SSL connection\n* Launch Shell > Connect via SSL\n\n*Notes:*\n* Depends on the Docker SSH/TLS environments ticket."
  },
  {
    "summary": "Add e2e tests for managing connections in the tree view",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Cover adding, switching, copying, and removing connections from the MongoDB tree view.\n\n*Testing matrix rows:*\n* Tree View > Can add a connection with the buttons in the tree view\n* Tree View > When a connection is added it is shown in the tree view\n* Tree View > Can switch connections in the tree view\n* Tree View > Can copy a connection's connection string (right click)\n* Tree View > Can remove a connection (command palette and right click)\n\n*Notes:*\n* Switching needs two distinct servers (e.g. two mongod ports).\n* Read the clipboard via electronApp.evaluate to assert the copied string."
  },
  {
    "summary": "Add e2e tests for browsing databases, collections, and schema in the tree view",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Expand a connection and verify databases, collections, documents, and schema; verify refresh picks up a database/collection created from a playground and that it then autocompletes. The documents list is already covered, so build on that.\n\n*Testing matrix rows:*\n* Tree View > When connected, you can see databases, collections, and documents\n* Tree View > A collection's schema is shown in the tree view\n* Tree View > Refresh shows new dbs and collections created from playground and adds them to autocomplete"
  },
  {
    "summary": "Add e2e tests for playground run behaviour",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Cover the run flow around a playground beyond the happy path already tested.\n\n*Testing matrix rows:*\n* Playgrounds > When not connected, a playground cannot be run and the user is prompted to connect\n* Playgrounds > A confirmation is shown before running; selecting 'no' does not run\n* Playgrounds > The playground editor remains visible and the result pane splits to the right\n* Playgrounds > Can run a playground twice\n\n*Notes:*\n* launchVSCode sets mdb.confirmRunAll to false; the confirmation test must turn it back on."
  },
  {
    "summary": "Add e2e test for cancelling a long-running playground",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Run while(true) {}, cancel it, then run a simple command and verify it returns a result. Kept separate because it is timing-sensitive.\n\n*Testing matrix rows:*\n* Playgrounds > Can cancel a playground that is running for a long time and then run a simple non-blocking command"
  },
  {
    "summary": "Add e2e tests for the overview page, resources panel, and help links",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e"
    ],
    "description": "Opening the connection form from the overview page is already covered by connection-form.test.ts.\n\n*Testing matrix rows:*\n* Overview > Shows your connected status\n* Overview > Can open a connection string input\n* Overview > Can view the resources panel\n* Tree View > Can open a link from Help and Feedback\n\n*Notes:*\n* Stub shell.openExternal in the Electron main process to assert links without opening a browser."
  },
  {
    "summary": "Spike: e2e coverage for Copilot with the MongoDB MCP Server",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "spike"
    ],
    "description": "Copilot chat needs a signed-in GitHub account, which makes this hard to run in CI.\n\n*Testing matrix rows:*\n* Copilot MongoDB MCP Server > Can ask Copilot MongoDB questions and it responds using MongoDB MCP Server\n\n*Scope:*\n* Check whether we can assert the MCP server registers, starts, and lists its tools without Copilot.\n* Evaluate a dedicated test account secret for the full chat flow, possibly nightly only.\n* Outcome: follow-up ticket(s) or a decision to keep this manual."
  },
  {
    "summary": "Spike: e2e coverage for WSL",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e",
      "spike"
    ],
    "description": "Investigate whether GitHub Windows runners can provide a WSL distro for these tests, or keep them manual.\n\n*Testing matrix rows:*\n* Launch Shell > Connect via WSL\n* Playgrounds > Can run a playground against the WSL connection"
  },
  {
    "summary": "Map e2e tests to the testing matrix and update the release checklist",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e"
    ],
    "description": "Make it obvious which matrix rows are automated so they can be dropped from the manual release pass.\n\n*Scope:*\n* Add a Playwright annotation on each test naming the matrix row(s) it covers.\n* Update the matrix's e2e column, including rows already covered but unmarked: Saved connection > Connect on Windows (connection.test.ts) and Overview > Can open a connection form (connection-form.test.ts).\n* Remove automated rows from the manual release template once the suites are stable."
  }
];

const isBrowser = typeof window !== 'undefined';
const BASE = isBrowser ? location.origin : process.env.JIRA_URL;

async function jira(path, init = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Atlassian-Token': 'no-check',
    ...(!isBrowser && { Authorization: `Bearer ${process.env.JIRA_TOKEN}` }),
  };
  const res = await fetch(`${BASE}/rest/api/2${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function createTickets({ dryRun = true } = {}) {
  const epicField = (await jira('/field')).find((f) => f.name === 'Epic Link');
  if (!epicField) throw new Error('No "Epic Link" field found');

  const jql = encodeURIComponent(`"Epic Link" = ${EPIC}`);
  const existing = new Set(
    (await jira(`/search?jql=${jql}&fields=summary&maxResults=200`)).issues.map(
      (i) => i.fields.summary,
    ),
  );

  for (const t of TICKETS) {
    if (existing.has(t.summary)) {
      console.log(`skip (exists): ${t.summary}`);
      continue;
    }
    if (dryRun) {
      console.log(`would create: ${t.summary}`);
      continue;
    }
    const fields = {
      project: { key: PROJECT },
      issuetype: { name: t.issueType },
      summary: t.summary,
      description: t.description,
      priority: { name: t.priority },
      labels: t.labels,
      [epicField.id]: EPIC,
    };
    try {
      const { key } = await jira('/issue', { method: 'POST', body: JSON.stringify({ fields }) });
      console.log(`created ${key}: ${t.summary}`);
    } catch (err) {
      console.error(`failed: ${t.summary}\n${err.message}`);
    }
  }
  if (dryRun) console.log('Dry run done. Run `await createTickets({ dryRun: false })` to create.');
}

if (isBrowser) {
  createTickets();
} else {
  createTickets({ dryRun: !process.argv.includes('--create') }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
