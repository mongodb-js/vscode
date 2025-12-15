export const DocumentSource = {
  TREEVIEW: 'treeview',
  PLAYGROUND: 'playground',
  COLLECTIONVIEW: 'collectionview',
  CODELENS: 'codelens',
} as const;

export type DocumentSource =
  (typeof DocumentSource)[keyof typeof DocumentSource];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
