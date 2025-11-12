export const DOCUMENT_SOURCE = {
  DOCUMENT_SOURCE_TREEVIEW: 'treeview',
  DOCUMENT_SOURCE_PLAYGROUND: 'playground',
  DOCUMENT_SOURCE_COLLECTIONVIEW: 'collectionview',
  DOCUMENT_SOURCE_CODELENS: 'codelens',
} as const;

export type DocumentSource =
  (typeof DOCUMENT_SOURCE)[keyof typeof DOCUMENT_SOURCE];

export type DocumentSourceDetails = 'database' | 'collection' | undefined;
