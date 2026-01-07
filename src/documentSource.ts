export const DocumentSource = {
  treeview: 'treeview',
  playground: 'playground',
  collectionview: 'collectionview',
  codelens: 'codelens',
} as const;

export type DocumentSource =
  (typeof DocumentSource)[keyof typeof DocumentSource];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
