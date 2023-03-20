import { v4 as uuidv4 } from 'uuid';
import type { BSONSerializableTypes } from './../types/editDocumentInfoType';

// In order to provide opening documents with various _id types we need
// to pass the documentId and create associated documentIdReference.
// documentId can potentially be large, therefore we want to avoid
// passing it as a part of URI query.
export default class DocumentIdStore {
  _documents: {
    documentIdReference: string;
    documentId: BSONSerializableTypes;
  }[] = [];

  add(documentId: BSONSerializableTypes): string {
    const existingDocument = this._documents.find(
      (item) => item.documentId === documentId
    );

    if (existingDocument) {
      return existingDocument.documentIdReference;
    }

    const newDocument: {
      documentIdReference: string;
      documentId: BSONSerializableTypes;
    } = {
      documentIdReference: uuidv4(),
      documentId,
    };

    this._documents.push(newDocument);

    return newDocument.documentIdReference;
  }

  get(documentIdReference: string): BSONSerializableTypes | undefined {
    const existingDocument = this._documents.find(
      (item) => item.documentIdReference === documentIdReference
    );

    return existingDocument?.documentId;
  }

  removeByDocumentIdReference(documentIdReference: string): void {
    this._documents = this._documents.filter(
      (item) => item.documentIdReference !== documentIdReference
    );
  }
}
