const addUTMAttrs = (url: string): string => {
  const parsed = new URL(url);
  if (!parsed.host.includes('mongodb')) {
    return url;
  }
  parsed.searchParams.set('utm_source', 'vscode');
  parsed.searchParams.set('utm_medium', 'product');
  return parsed.toString();
};

const LINKS = {
  changelog: 'https://github.com/mongodb-js/vscode/blob/main/CHANGELOG.md',
  feedback: 'https://feedback.mongodb.com/?category=7548143030521447168',
  github: 'https://github.com/mongodb-js/vscode',
  reportBug: 'https://github.com/mongodb-js/vscode/issues',
  atlas: 'https://www.mongodb.com/cloud/atlas',
  /**
   * @param anonymousId Segment analytics `anonymousId` (not `userId`) {@link https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/querystring/}
   */
  createAtlasCluster: (anonymousId: string): string => {
    const ajsAid = anonymousId
      ? `?ajs_aid=${encodeURIComponent(anonymousId)}`
      : '';
    return `https://mongodb.com/products/vs-code/vs-code-atlas-signup${ajsAid}`;
  },
  docs: 'https://docs.mongodb.com/',
  mongodbDocs: 'https://docs.mongodb.com/manual/',
  extensionDocs(subcategory = ''): string {
    return `https://docs.mongodb.com/mongodb-vscode/${subcategory}`;
  },
  aggregationDocs: (title: string): string => {
    return `https://www.mongodb.com/docs/manual/reference/operator/aggregation/${title}/`;
  },
  bsonDocs: (type: string): string => {
    return `https://www.mongodb.com/docs/mongodb-shell/reference/data-types/#${type}`;
  },
  systemVariableDocs: (name: string): string => {
    return `https://www.mongodb.com/docs/manual/reference/aggregation-variables/#mongodb-variable-variable.${name}`;
  },
  ldapDocs: 'https://docs.mongodb.com/manual/core/security-ldap/',
  authDatabaseDocs:
    'https://docs.mongodb.com/manual/core/security-users/#user-authentication-database',
  sshConnectionDocs:
    'https://docs.mongodb.com/compass/current/connect/advanced-connection-options/ssh-connection/#ssh-connection',
  configureSSLDocs(subsection = ''): string {
    return `https://docs.mongodb.com/manual/tutorial/configure-ssl/${subsection}`;
  },
  pemKeysDocs:
    'https://docs.mongodb.com/manual/reference/configuration-options/#net.ssl.PEMKeyPassword',
};

export default Object.fromEntries(
  Object.entries(LINKS).map(([k, v]) => {
    return [
      k,
      typeof v === 'string'
        ? addUTMAttrs(v)
        : (name: string): string => {
            return addUTMAttrs(v(name));
          },
    ];
  }),
) as typeof LINKS;
