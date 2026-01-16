import type { DocumentSource } from '../documentSource';
import type { DocumentViewAndEditFormat } from '../editors/types';

export type EditDocumentInfo = {
  source: DocumentSource;
  line: number;
  documentId: any;
  namespace: string;
  format: DocumentViewAndEditFormat;
  connectionId: string | null;
};
