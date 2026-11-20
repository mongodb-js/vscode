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
    "description": "Every spec in src/test/e2e repeats the same beforeAll/afterEach/afterAll (start mongod, launch VS Code, wait for ready, screenshot on failure, copy logs, teardown). Failure screenshots are attached to the report in some files and not others. Tree row locators, the connected-state regex, and the overview webview frame chain are duplicated across specs. Do this first so the new suites start from a clean base.\n\n*Scope:*\n* Worker-scoped fixtures for mongod and the VS Code app; test-scoped page with automatic failure screenshot attachment and log copy.\n* Page objects/helpers for the connection tree (row, connected state, expand, context menu), overview webview, connection form, playground, and data browser.\n* Make mongod topology, port, and TLS options configurable so later suites can reuse the fixtures, including running two servers at once.\n* Remove silent .catch(() => {}) calls that can hide real failures.\n\n*Notes:*\n* AC: existing tests pass on Linux, macOS, and Windows; a new spec needs no setup boilerplate."
  },
  {
    "summary": "Run e2e tests in a dedicated CI job with tag-based filtering",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "ci"
    ],
    "description": "pnpm run test runs e2e, webview, and extension tests in a single step per OS, so an e2e failure hides the other results and the job is slow to rerun.\n\n*Scope:*\n* Split e2e into its own job (ubuntu, windows, macos) in test-and-build.yaml and test-and-build-from-fork.yaml, keeping the artifact upload.\n* Add Playwright tags (e.g. @atlas) and a scheduled/main-only run for suites that need secrets or external services.\n* Decide on CI retries and flaky-test reporting (currently retries: 0).\n* Document running a single suite or tag locally in CONTRIBUTING.md."
  },
  {
    "summary": "Run e2e tests against VS Code Stable in addition to Insiders",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e",
      "ci"
    ],
    "description": "globalSetup and launchVSCode only download Insiders, while most users and the manual release pass use Stable. Add Stable as a Playwright project or CI matrix dimension (e.g. Stable on every PR, Insiders nightly)."
  },
  {
    "summary": "Add cross-platform SSH and TLS test servers for e2e tests",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "infra"
    ],
    "description": "The SSH and TLS suites need servers that run on every CI OS, since connection bugs are often platform-specific.\n\n*Scope:*\n* SSH: an in-process ssh2 server (ssh2 is already a transitive dependency via devtools-proxy-support) that accepts password and key auth and forwards to the test mongod.\n* TLS: start mongod with TLS through mongodb-runner using committed test certificates (CA, server, and client).\n* Expose hosts, credentials, and certificate paths through the shared fixtures.\n\n*Notes:*\n* Fallback if the in-process approach is not viable: mongodb-js/devtools-docker-test-envs on Linux runners only.\n* Blocks the SSH and TLS test tickets."
  },
  {
    "summary": "Add e2e tests for SSH tunnel connections",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "SSH connections reach the playground language server through proxy options, and launch shell through a VS Code-specific connection string rewrite (_getConnectionStringWithProxy), so both need to be tested against a real tunnel.\n\n*Testing matrix rows:*\n* Connection Form > Connect via SSH\n* Saved connection > Connect via SSH\n* Playgrounds > Can run a playground against the SSH connection\n* Playgrounds > Completion works in playground via SSH connection\n* Launch Shell > Connect via SSH\n\n*Scope:*\n* Connect through the form with password and identity file auth.\n* Reload, reconnect from the saved connection (SSH secrets restored from storage).\n* Run a playground and get db/collection completions over the tunnel.\n* Launch shell and assert mongosh receives the proxy connection string.\n\n*Notes:*\n* Depends on the SSH/TLS test servers ticket."
  },
  {
    "summary": "Add e2e tests for TLS connections",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Connect with a CA file and client certificate, reconnect from the saved connection after a reload, run a playground, and launch the shell. Certificate file paths have to reach the language server worker and mongosh correctly.\n\n*Testing matrix rows:*\n* Connection Form > Connect via SSL\n* Saved connection > Connect via SSL\n* Playgrounds > Can run a playground against a TLS/SSL connection\n* Launch Shell > Connect via SSL\n\n*Notes:*\n* Depends on the SSH/TLS test servers ticket."
  },
  {
    "summary": "Add e2e tests for connecting to an Atlas SRV cluster",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Most users connect to Atlas with mongodb+srv, which exercises DNS SRV/TXT resolution and Atlas TLS that a local mongod does not.\n\n*Testing matrix rows:*\n* Connection String > Connect to Compass dataset (srv)\n* Launch Shell > Connect to Compass dataset (srv)\n\n*Scope:*\n* Store a read-only SRV connection string as a CI secret; tag @atlas and run on main/nightly only so fork PRs and outages do not block merges.\n* Connect with the connection string, verify databases load, run a simple playground, and assert launch shell receives the mongodb+srv string.\n\n*Notes:*\n* The form and saved connection SRV rows add little once connected, since they share the localhost code path."
  },
  {
    "summary": "Add e2e tests for data browser document actions",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "The webview data browser is the default way to view documents, but e2e only covers opening it and editing a document. Cover the remaining actions against a real database.\n\n*Scope:*\n* Insert a document and clone a document; verify both in the database.\n* Delete a single document and bulk delete, including the confirmation prompt.\n* Pagination (items per page, next/previous) and sort against a seeded collection.\n* Refresh after an external change, and stopping a slow query."
  },
  {
    "summary": "Add e2e test for cancelling and re-running a playground",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Nothing tests playground cancellation today. Run while(true) {}, cancel it, then run a simple command and run it again, verifying both results. This exercises terminating and restarting the language server worker, which unit tests cannot.\n\n*Testing matrix rows:*\n* Playgrounds > Can cancel a playground that is running for a long time and then run a simple non-blocking command\n* Playgrounds > Can run a playground twice"
  },
  {
    "summary": "Add e2e test for switching the active connection",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "With two servers holding different data, connect to one, switch to the other, and verify every consumer of the active connection follows.\n\n*Testing matrix rows:*\n* Tree View > Can switch connections in the tree view\n* Overview > Can view the overview page and it shows your connected status\n\n*Scope:*\n* Tree view marks only the new connection as connected and shows its databases.\n* Overview page shows the new connection status.\n* A playground run and its completions target the new server."
  },
  {
    "summary": "Add e2e tests for connection actions in the tree view",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e"
    ],
    "description": "Unit tests check that context values exist in package.json, but not that the menu actions work end to end.\n\n*Testing matrix rows:*\n* Tree View > Can copy a connection's connection string\n* Tree View > Can remove a connection (command palette and right click)\n\n*Scope:*\n* Edit connection: the form opens prefilled, saving reconnects with the new options.\n* Rename connection: the new name shows in the tree and survives a reload.\n* Copy connection string: read the clipboard via electronApp.evaluate.\n* Remove connection from the context menu and from the command palette."
  },
  {
    "summary": "Add e2e test for creating and dropping databases and collections from the tree view",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e"
    ],
    "description": "Use Add Database/Add Collection from the tree, run the generated playground, and verify refresh shows the new database and collection and that they appear in playground completions. Then drop the collection and database through their confirmation prompts and verify they disappear.\n\n*Testing matrix rows:*\n* Tree View > The Refresh shows new dbs and collections created from playground and adds them to autocomplete"
  },
  {
    "summary": "Spike: e2e coverage for the MongoDB MCP Server",
    "issueType": "Task",
    "priority": "Major - P3",
    "labels": [
      "e2e",
      "spike"
    ],
    "description": "The matrix row targets the Copilot participant, which is deprecated (VSCODE-816). The extension now registers the MongoDB MCP Server with VS Code, and that integration is untested end to end.\n\n*Scope:*\n* Find a way to observe the MCP server from e2e: start it with \"MongoDB: Start MCP Server\" and check that VS Code lists it as running, or call a tool directly.\n* Verify the server follows the active connection when it changes.\n* Avoid needing a Copilot account in CI.\n* Outcome: follow-up ticket(s), or a decision to keep this manual."
  },
  {
    "summary": "Map e2e tests to the release testing matrix and retire automated rows",
    "issueType": "Task",
    "priority": "Minor - P4",
    "labels": [
      "e2e"
    ],
    "description": "Make it obvious which manual checks are automated so they can be dropped from the release pass.\n\n*Scope:*\n* Add a Playwright annotation on each test naming the matrix row(s) it covers.\n* Update the matrix's e2e column, including rows already covered but unmarked: Saved connection > Connect on Windows (connection.test.ts) and Overview > Can open a connection form (connection-form.test.ts).\n* Remove rows that are now automated, or covered well enough by unit/integration tests (e.g. the playground confirmation modal and the not-connected prompt), and the stale Copilot row."
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
