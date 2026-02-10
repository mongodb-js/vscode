export const DocumentSource = {
  treeview: 'treeview',
  playground: 'playground',
  collectionview: 'collectionview',
  codelens: 'codelens',
  databrowser: 'databrowser',
} as const;

export type DocumentSource =
  (typeof DocumentSource)[keyof typeof DocumentSource];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
