import { DocumentSource } from '../documentSource';

export type EditDocumentInfo = {
  source: DocumentSource;
  line: number;
  documentId: any;
  namespace: string;
  connectionId: string | null;
};
