// Creates the VSCODE-828 e2e tickets via the Jira REST API.
// Browser: open Jira while logged in, paste this into the DevTools console. It does a dry run;
//   then run `await createTickets({ dryRun: false })`.
// Node 18+: JIRA_URL=https://jira.mongodb.org JIRA_TOKEN=<personal access token> node create-tickets.js [--create]

const PROJECT = 'VSCODE';
const EPIC = __EPIC__;
const TICKETS = __TICKETS__;

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
