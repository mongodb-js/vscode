export const DocumentSource = {
  DocumentSource_TREEVIEW: 'treeview',
  DocumentSource_PLAYGROUND: 'playground',
  DocumentSource_COLLECTIONVIEW: 'collectionview',
  DocumentSource_CODELENS: 'codelens',
} as const;

export type DocumentSource =
  (typeof DocumentSource)[keyof typeof DocumentSource];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
