import * as vscode from 'vscode';
import { ObjectId } from 'bson';

export function createIdFactory(): () => ObjectId {
  const uniqueObjectIdPerCursor = vscode.workspace
    .getConfiguration('mdb')
    .get('uniqueObjectIdPerCursor', false);

  if (uniqueObjectIdPerCursor) {
    return () => new ObjectId();
  }

  const staticObjectId = new ObjectId();
  return () => staticObjectId;
}

export function generateId(): ObjectId {
  return new ObjectId();
}
