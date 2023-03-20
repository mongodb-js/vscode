
import type { Document } from 'bson';
import { DocumentSource } from '../documentSource';

export type JSONPrimitive = string | number | boolean | null;
export type BSONSerializableTypes = Document | Array<JSONPrimitive | Document> | JSONPrimitive;

export type EditDocumentInfo = {
  source: DocumentSource;
  line: number;
  documentId: BSONSerializableTypes;
  namespace: string;
  connectionId: string | null;
};
