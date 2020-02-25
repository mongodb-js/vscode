import { v4 as uuidv4 } from 'uuid';
const DOCUMENTS_LIMIT = 10;

export class CollectionDocumentsOperation {
  currentLimit = DOCUMENTS_LIMIT;
  hasMoreDocumentsToShow = true;
  isCurrentlyFetchingMoreDocuments = false;
}

// In order to provide `show more documents...` code lens functionality we
// need to store the current limit of documents outside of each document.
// This store helps maintain the metadata around the queries that have been run.
export default class CollectionDocumentsOperationsStore {
  operationDocLimits: { [key: string]: CollectionDocumentsOperation } = {};

  createNewOperation(): string {
    const operationId = uuidv4();

    this.operationDocLimits[operationId] = new CollectionDocumentsOperation();

    return operationId;
  }

  increaseOperationDocumentLimit(operationId: string): void {
    this.operationDocLimits[operationId].isCurrentlyFetchingMoreDocuments = false;
    this.operationDocLimits[operationId].currentLimit += DOCUMENTS_LIMIT;
  }
}
