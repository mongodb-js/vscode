import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

export class CollectionDocumentsOperation {
  currentLimit: number;
  hasMoreDocumentsToShow = true;
  isCurrentlyFetchingMoreDocuments = false;

  constructor(initialDocumentsLimit: number) {
    this.currentLimit = initialDocumentsLimit;
  }
}

const DEFAULT_LIMIT_CONFIG_NAME = 'defaultLimit';

// In order to provide `show more documents...` code lens functionality we
// need to store the current limit of documents outside of each document.
// This store helps maintain the metadata around the queries that have been run.
export default class CollectionDocumentsOperationsStore {
  operations: { [key: string]: CollectionDocumentsOperation } = {};

  createNewOperation(): string {
    const operationId = uuidv4();

    const initialDocumentsLimit = vscode.workspace
      .getConfiguration('mdb')
      .get(DEFAULT_LIMIT_CONFIG_NAME);
    this.operations[operationId] = new CollectionDocumentsOperation(
      Number(initialDocumentsLimit),
    );

    return operationId;
  }

  increaseOperationDocumentLimit(operationId: string): void {
    this.operations[operationId].isCurrentlyFetchingMoreDocuments = false;

    const additionalDocumentsToFetch = vscode.workspace
      .getConfiguration('mdb')
      .get(DEFAULT_LIMIT_CONFIG_NAME);
    this.operations[operationId].currentLimit += Number(
      additionalDocumentsToFetch,
    );
  }
}
