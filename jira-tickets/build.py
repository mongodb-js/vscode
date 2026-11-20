import csv, json, sys

EPIC = 'VSCODE-828'
MAJ, MIN = 'Major - P3', 'Minor - P4'

def desc(context, rows=None, scope=None, notes=None):
    out = [context]
    if rows:
        out += ['', '*Testing matrix rows:*'] + [f'* {r}' for r in rows]
    if scope:
        out += ['', '*Scope:*'] + [f'* {s}' for s in scope]
    if notes:
        out += ['', '*Notes:*'] + [f'* {n}' for n in notes]
    return '\n'.join(out)

T = [
 ('Refactor e2e tests to use shared Playwright fixtures and page objects', 'Task', MAJ, 'e2e,refactor',
  desc('Every spec in src/test/e2e repeats the same beforeAll/afterEach/afterAll (start mongod, launch VS Code, wait for ready, screenshot on failure, copy logs, teardown). Failure screenshots are attached to the report in some files and not others. Tree row locators, the connected-state regex, and the overview webview frame chain are duplicated across specs. Do this first so the new suites start from a clean base.',
       scope=['Worker-scoped fixtures for mongod and the VS Code app; test-scoped page with automatic failure screenshot attachment and log copy.',
              'Page objects/helpers for the connection tree (row, connected state, expand, context menu), overview webview, connection form, playground, and data browser.',
              'Make mongod topology, port, and TLS options configurable so later suites can reuse the fixtures, including running two servers at once.',
              'Remove silent .catch(() => {}) calls that can hide real failures.'],
       notes=['AC: existing tests pass on Linux, macOS, and Windows; a new spec needs no setup boilerplate.'])),
 ('Run e2e tests in a dedicated CI job with tag-based filtering', 'Task', MAJ, 'e2e,ci',
  desc('pnpm run test runs e2e, webview, and extension tests in a single step per OS, so an e2e failure hides the other results and the job is slow to rerun.',
       scope=['Split e2e into its own job (ubuntu, windows, macos) in test-and-build.yaml and test-and-build-from-fork.yaml, keeping the artifact upload.',
              'Add Playwright tags (e.g. @atlas) and a scheduled/main-only run for suites that need secrets or external services.',
              'Decide on CI retries and flaky-test reporting (currently retries: 0).',
              'Document running a single suite or tag locally in CONTRIBUTING.md.'])),
 ('Run e2e tests against VS Code Stable in addition to Insiders', 'Task', MIN, 'e2e,ci',
  desc('globalSetup and launchVSCode only download Insiders, while most users and the manual release pass use Stable. Add Stable as a Playwright project or CI matrix dimension (e.g. Stable on every PR, Insiders nightly).')),
 ('Add cross-platform SSH and TLS test servers for e2e tests', 'Task', MAJ, 'e2e,infra',
  desc('The SSH and TLS suites need servers that run on every CI OS, since connection bugs are often platform-specific.',
       scope=['SSH: an in-process ssh2 server (ssh2 is already a transitive dependency via devtools-proxy-support) that accepts password and key auth and forwards to the test mongod.',
              'TLS: start mongod with TLS through mongodb-runner using committed test certificates (CA, server, and client).',
              'Expose hosts, credentials, and certificate paths through the shared fixtures.'],
       notes=['Fallback if the in-process approach is not viable: mongodb-js/devtools-docker-test-envs on Linux runners only.',
              'Blocks the SSH and TLS test tickets.'])),
 ('Add e2e tests for SSH tunnel connections', 'Task', MAJ, 'e2e',
  desc('SSH connections reach the playground language server through proxy options, and launch shell through a VS Code-specific connection string rewrite (_getConnectionStringWithProxy), so both need to be tested against a real tunnel.',
       rows=['Connection Form > Connect via SSH', 'Saved connection > Connect via SSH', 'Playgrounds > Can run a playground against the SSH connection', 'Playgrounds > Completion works in playground via SSH connection', 'Launch Shell > Connect via SSH'],
       scope=['Connect through the form with password and identity file auth.',
              'Reload, reconnect from the saved connection (SSH secrets restored from storage).',
              'Run a playground and get db/collection completions over the tunnel.',
              'Launch shell and assert mongosh receives the proxy connection string.'],
       notes=['Depends on the SSH/TLS test servers ticket.'])),
 ('Add e2e tests for TLS connections', 'Task', MAJ, 'e2e',
  desc('Connect with a CA file and client certificate, reconnect from the saved connection after a reload, run a playground, and launch the shell. Certificate file paths have to reach the language server worker and mongosh correctly.',
       rows=['Connection Form > Connect via SSL', 'Saved connection > Connect via SSL', 'Playgrounds > Can run a playground against a TLS/SSL connection', 'Launch Shell > Connect via SSL'],
       notes=['Depends on the SSH/TLS test servers ticket.'])),
 ('Add e2e tests for connecting to an Atlas SRV cluster', 'Task', MAJ, 'e2e',
  desc('Most users connect to Atlas with mongodb+srv, which exercises DNS SRV/TXT resolution and Atlas TLS that a local mongod does not.',
       rows=['Connection String > Connect to Compass dataset (srv)', 'Launch Shell > Connect to Compass dataset (srv)'],
       scope=['Store a read-only SRV connection string as a CI secret; tag @atlas and run on main/nightly only so fork PRs and outages do not block merges.',
              'Connect with the connection string, verify databases load, run a simple playground, and assert launch shell receives the mongodb+srv string.'],
       notes=['The form and saved connection SRV rows add little once connected, since they share the localhost code path.'])),
 ('Add e2e tests for data browser document actions', 'Task', MAJ, 'e2e',
  desc('The webview data browser is the default way to view documents, but e2e only covers opening it and editing a document. Cover the remaining actions against a real database.',
       scope=['Insert a document and clone a document; verify both in the database.',
              'Delete a single document and bulk delete, including the confirmation prompt.',
              'Pagination (items per page, next/previous) and sort against a seeded collection.',
              'Refresh after an external change, and stopping a slow query.'])),
 ('Add e2e test for cancelling and re-running a playground', 'Task', MAJ, 'e2e',
  desc('Nothing tests playground cancellation today. Run while(true) {}, cancel it, then run a simple command and run it again, verifying both results. This exercises terminating and restarting the language server worker, which unit tests cannot.',
       rows=['Playgrounds > Can cancel a playground that is running for a long time and then run a simple non-blocking command', 'Playgrounds > Can run a playground twice'])),
 ('Add e2e test for switching the active connection', 'Task', MAJ, 'e2e',
  desc('With two servers holding different data, connect to one, switch to the other, and verify every consumer of the active connection follows.',
       rows=['Tree View > Can switch connections in the tree view', 'Overview > Can view the overview page and it shows your connected status'],
       scope=['Tree view marks only the new connection as connected and shows its databases.',
              'Overview page shows the new connection status.',
              'A playground run and its completions target the new server.'])),
 ('Add e2e tests for connection actions in the tree view', 'Task', MAJ, 'e2e',
  desc('Unit tests check that context values exist in package.json, but not that the menu actions work end to end.',
       rows=["Tree View > Can copy a connection's connection string", 'Tree View > Can remove a connection (command palette and right click)'],
       scope=['Edit connection: the form opens prefilled, saving reconnects with the new options.',
              'Rename connection: the new name shows in the tree and survives a reload.',
              'Copy connection string: read the clipboard via electronApp.evaluate.',
              'Remove connection from the context menu and from the command palette.'])),
 ('Add e2e test for creating and dropping databases and collections from the tree view', 'Task', MIN, 'e2e',
  desc('Use Add Database/Add Collection from the tree, run the generated playground, and verify refresh shows the new database and collection and that they appear in playground completions. Then drop the collection and database through their confirmation prompts and verify they disappear.',
       rows=['Tree View > The Refresh shows new dbs and collections created from playground and adds them to autocomplete'])),
 ('Spike: e2e coverage for the MongoDB MCP Server', 'Task', MAJ, 'e2e,spike',
  desc('The matrix row targets the Copilot participant, which is deprecated (VSCODE-816). The extension now registers the MongoDB MCP Server with VS Code, and that integration is untested end to end.',
       scope=['Find a way to observe the MCP server from e2e: start it with "MongoDB: Start MCP Server" and check that VS Code lists it as running, or call a tool directly.',
              'Verify the server follows the active connection when it changes.',
              'Avoid needing a Copilot account in CI.',
              'Outcome: follow-up ticket(s), or a decision to keep this manual.'])),
 ('Map e2e tests to the release testing matrix and retire automated rows', 'Task', MIN, 'e2e',
  desc('Make it obvious which manual checks are automated so they can be dropped from the release pass.',
       scope=['Add a Playwright annotation on each test naming the matrix row(s) it covers.',
              "Update the matrix's e2e column, including rows already covered but unmarked: Saved connection > Connect on Windows (connection.test.ts) and Overview > Can open a connection form (connection-form.test.ts).",
              'Remove rows that are now automated, or covered well enough by unit/integration tests (e.g. the playground confirmation modal and the not-connected prompt), and the stale Copilot row.'])),
]

out = sys.argv[1]
with open(out + '.csv', 'w', newline='') as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(['Summary', 'Issue Type', 'Priority', 'Labels', 'Epic Link', 'Description'])
    for s, it, p, labels, d in T:
        w.writerow([s, it, p, labels, EPIC, d])

tickets = [dict(summary=s, issueType=it, priority=p, labels=labels.split(','), description=d) for s, it, p, labels, d in T]
js = open('create-tickets.template.js').read()
js = js.replace('__EPIC__', json.dumps(EPIC)).replace('__TICKETS__', json.dumps(tickets, indent=2))
open('create-tickets.js', 'w').write(js)
print(len(T), 'tickets')
