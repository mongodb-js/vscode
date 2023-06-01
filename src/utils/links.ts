const addUTMAttrs = (url: string) => {
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
  extensionDocs: 'https://docs.mongodb.com/mongodb-vscode/',
  mongodbDocs: 'https://docs.mongodb.com/manual/',
  feedback: 'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/',
  reportBug: 'https://github.com/mongodb-js/vscode/issues',
  createAtlasCluster: (userId: string) => {
    const ajsAid = userId ? `?ajs_aid=${encodeURIComponent(userId)}` : '';
    return `https://mongodb.com/products/vs-code/vs-code-atlas-signup${ajsAid}`;
  },
  aggregationDocs: (title: string) => {
    return `https://www.mongodb.com/docs/manual/reference/operator/aggregation/${title}/`;
  },
  bsonDocs: (type: string) => {
    return `https://www.mongodb.com/docs/mongodb-shell/reference/data-types/#${type}`;
  },
  systemVariableDocs: (name: string) => {
    return `https://www.mongodb.com/docs/manual/reference/aggregation-variables/#mongodb-variable-variable.${name}`;
  },
};

export default Object.fromEntries(
  Object.entries(LINKS).map(([k, v]) => {
    return [
      k,
      typeof v === 'string'
        ? addUTMAttrs(v)
        : (name: string) => {
            return addUTMAttrs(v(name));
          },
    ];
  })
) as typeof LINKS;
