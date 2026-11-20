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
  desc('Every spec in src/test/e2e repeats the same beforeAll/afterEach/afterAll (start mongod, launch VS Code, wait for ready, screenshot on failure, copy logs, teardown). Failure screenshots are attached to the report in some files and not others. Tree row locators, the connected-state regex, and the overview webview frame chain are duplicated across specs. Do this before adding the new suites so they start from a clean base.',
       scope=['Worker-scoped fixtures for mongod and the VS Code app; test-scoped page with automatic failure screenshot attachment and log copy.',
              'Page objects/helpers for the connection tree (row, connected state, expand, context menu), overview webview, connection form, and playground.',
              'Make mongod topology and port configurable so replica set and Docker-backed suites can reuse the fixtures.',
              'Remove silent .catch(() => {}) calls that can hide real failures.'],
       notes=['AC: existing tests pass on Linux, macOS, and Windows; a new spec needs no setup boilerplate.'])),
 ('Run e2e tests in a dedicated CI job with tag-based filtering', 'Task', MAJ, 'e2e,ci',
  desc('pnpm run test runs e2e, webview, and extension tests in a single step per OS, so an e2e failure hides the other results and the job is slow to rerun.',
       scope=['Split e2e into its own job (ubuntu, windows, macos) in test-and-build.yaml and test-and-build-from-fork.yaml, keeping the artifact upload.',
              'Introduce Playwright tags (e.g. @docker, @atlas) so environment-dependent suites are skipped where the environment is unavailable.',
              'Decide on CI retries and flaky-test reporting (currently retries: 0).',
              'Document running a single suite or tag locally in CONTRIBUTING.md.'])),
 ('Run e2e tests against VS Code Stable in addition to Insiders', 'Task', MIN, 'e2e,ci',
  desc('globalSetup and launchVSCode only download Insiders, while most users and the manual release pass use Stable. Add Stable as a Playwright project or CI matrix dimension (Stable on every PR, Insiders nightly is one option).')),
 ('Add Docker-based SSH and TLS environments for e2e tests', 'Task', MAJ, 'e2e,infra',
  desc('Several critical-path matrix rows need SSH and TLS servers. Use mongodb-js/devtools-docker-test-envs (as Compass does) to provide them.',
       scope=['Helpers to start/stop the SSH (password and identity file) and TLS (CA, client certificate) compose environments and expose their hosts, credentials, and cert paths.',
              'Run on Linux CI runners only (GitHub macOS/Windows runners cannot run Linux containers); tag the suites @docker so they skip elsewhere.'],
       notes=['Blocks the SSH and TLS ticket(s).'])),
 ('Add e2e tests for connecting to an Atlas SRV cluster', 'Task', MAJ, 'e2e',
  desc('Cover connecting to a mongodb+srv cluster with the Compass test dataset.',
       rows=['Connection String > Connect to Compass dataset (srv)', 'Connection Form > Connect to Compass dataset (srv)', 'Saved connection > Connect to Compass dataset (srv)', 'Launch Shell > Connect to Compass dataset (srv)'],
       scope=['Store a read-only SRV connection string as a CI secret; skip (@atlas) when it is absent, e.g. on fork PRs.',
              'Connect via connection string and via the form, verify databases load, reconnect after reload, and assert launch shell receives the mongodb+srv string.'])),
 ('Add e2e test for connecting to a replica set via the connection form multi-host input', 'Task', MIN, 'e2e',
  desc('Start a replica set with mongodb-runner (no Docker needed), add each host in the form, connect, and verify data is visible.',
       rows=['Connection Form > Connect to replica set (using multi-host/port input)'])),
 ('Add e2e tests for SSH connections', 'Task', MAJ, 'e2e',
  desc('Connect through an SSH tunnel using password and identity file auth.',
       rows=['Connection Form > Connect via SSH', 'Saved connection > Connect via SSH', "Tree View > Can copy a connection's SSH connection string"],
       notes=['Depends on the Docker SSH/TLS environments ticket.'])),
 ('Add e2e tests for playgrounds and launch shell over SSH', 'Task', MAJ, 'e2e',
  desc('Run a playground, check autocompletion, and launch the shell against an SSH-tunnelled connection.',
       rows=['Playgrounds > Can run a playground against the SSH connection', 'Playgrounds > Completion works in playground via SSH connection', 'Launch Shell > Connect via SSH'],
       notes=['Depends on the Docker SSH/TLS environments and SSH connection tickets.'])),
 ('Add e2e tests for TLS/SSL connections', 'Task', MAJ, 'e2e',
  desc('Connect with TLS (CA file and client certificate), then run a playground and launch the shell against that connection.',
       rows=['Connection Form > Connect via SSL', 'Saved connection > Connect via SSL', 'Playgrounds > Can run a playground against a TLS/SSL connection', 'Launch Shell > Connect via SSL'],
       notes=['Depends on the Docker SSH/TLS environments ticket.'])),
 ('Add e2e tests for managing connections in the tree view', 'Task', MAJ, 'e2e',
  desc('Cover adding, switching, copying, and removing connections from the MongoDB tree view.',
       rows=['Tree View > Can add a connection with the buttons in the tree view', 'Tree View > When a connection is added it is shown in the tree view', "Tree View > Can switch connections in the tree view", "Tree View > Can copy a connection's connection string (right click)", 'Tree View > Can remove a connection (command palette and right click)'],
       notes=['Switching needs two distinct servers (e.g. two mongod ports).', 'Read the clipboard via electronApp.evaluate to assert the copied string.'])),
 ('Add e2e tests for browsing databases, collections, and schema in the tree view', 'Task', MAJ, 'e2e',
  desc('Expand a connection and verify databases, collections, documents, and schema; verify refresh picks up a database/collection created from a playground and that it then autocompletes. The documents list is already covered, so build on that.',
       rows=['Tree View > When connected, you can see databases, collections, and documents', "Tree View > A collection's schema is shown in the tree view", 'Tree View > Refresh shows new dbs and collections created from playground and adds them to autocomplete'])),
 ('Add e2e tests for playground run behaviour', 'Task', MAJ, 'e2e',
  desc('Cover the run flow around a playground beyond the happy path already tested.',
       rows=['Playgrounds > When not connected, a playground cannot be run and the user is prompted to connect', "Playgrounds > A confirmation is shown before running; selecting 'no' does not run", 'Playgrounds > The playground editor remains visible and the result pane splits to the right', 'Playgrounds > Can run a playground twice'],
       notes=['launchVSCode sets mdb.confirmRunAll to false; the confirmation test must turn it back on.'])),
 ('Add e2e test for cancelling a long-running playground', 'Task', MAJ, 'e2e',
  desc('Run while(true) {}, cancel it, then run a simple command and verify it returns a result. Kept separate because it is timing-sensitive.',
       rows=['Playgrounds > Can cancel a playground that is running for a long time and then run a simple non-blocking command'])),
 ('Add e2e tests for the overview page, resources panel, and help links', 'Task', MIN, 'e2e',
  desc('Opening the connection form from the overview page is already covered by connection-form.test.ts.',
       rows=['Overview > Shows your connected status', 'Overview > Can open a connection string input', 'Overview > Can view the resources panel', 'Tree View > Can open a link from Help and Feedback'],
       notes=['Stub shell.openExternal in the Electron main process to assert links without opening a browser.'])),
 ('Spike: e2e coverage for Copilot with the MongoDB MCP Server', 'Task', MAJ, 'e2e,spike',
  desc('Copilot chat needs a signed-in GitHub account, which makes this hard to run in CI.',
       rows=['Copilot MongoDB MCP Server > Can ask Copilot MongoDB questions and it responds using MongoDB MCP Server'],
       scope=['Check whether we can assert the MCP server registers, starts, and lists its tools without Copilot.',
              'Evaluate a dedicated test account secret for the full chat flow, possibly nightly only.',
              'Outcome: follow-up ticket(s) or a decision to keep this manual.'])),
 ('Spike: e2e coverage for WSL', 'Task', MIN, 'e2e,spike',
  desc('Investigate whether GitHub Windows runners can provide a WSL distro for these tests, or keep them manual.',
       rows=['Launch Shell > Connect via WSL', 'Playgrounds > Can run a playground against the WSL connection'])),
 ('Map e2e tests to the testing matrix and update the release checklist', 'Task', MIN, 'e2e',
  desc('Make it obvious which matrix rows are automated so they can be dropped from the manual release pass.',
       scope=['Add a Playwright annotation on each test naming the matrix row(s) it covers.',
              "Update the matrix's e2e column, including rows already covered but unmarked: Saved connection > Connect on Windows (connection.test.ts) and Overview > Can open a connection form (connection-form.test.ts).",
              'Remove automated rows from the manual release template once the suites are stable.'])),
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
