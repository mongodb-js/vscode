import { EJSON } from 'bson';
import { DocumentSource } from '../documentSource';

export type EditDocumentInfo = {
  source: DocumentSource;
  line: number;
  documentId: EJSON.SerializableTypes;
  namespace: string;
  connectionId: string | null;
};
