export const DocumentSource = {
  DOCUMENT_SOURCE_TREEVIEW: 'treeview',
  DOCUMENT_SOURCE_PLAYGROUND: 'playground',
  DOCUMENT_SOURCE_COLLECTIONVIEW: 'collectionview',
  DOCUMENT_SOURCE_CODELENS: 'codelens',
} as const;

export type DocumentSource =
  (typeof DocumentSource)[keyof typeof DocumentSource];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
