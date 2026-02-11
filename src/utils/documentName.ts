import * as vscode from 'vscode';
import { toJSString } from 'mongodb-query-parser';
import type { Document } from 'bson';

export function getDisplayNameForDocument(
  document: Document,
): string | undefined {
  // We use the array of display names from the user's settings
  // for pulling the name from the document. When the setting isn't
  // defined, we fallback to using the _id field.
  const defaultDisplayNameConfiguration = vscode.workspace
    .getConfiguration('mdb')
    .get('defaultDocumentDisplayName');

  let namedFieldValue: string | undefined = undefined;

  if (
    defaultDisplayNameConfiguration &&
    Array.isArray(defaultDisplayNameConfiguration)
  ) {
    for (const field of Array.prototype.values.call(
      defaultDisplayNameConfiguration,
    )) {
      if (
        typeof field === 'string' &&
        field in document &&
        typeof document[field] !== 'undefined' &&
        document[field] !== null &&
        typeof document[field] !== 'boolean'
      ) {
        const name = toJSString(document[field], 0);
        if (name && name.length > 0) {
          namedFieldValue = name;
          break;
        }
      }
    }
  }

  // document._id could be undefined, all of the fields in the
  // defaultDisplayNameConfiguration could be missing and toJSString() could
  // also return undefined.
  const documentName =
    namedFieldValue || document._id === undefined
      ? namedFieldValue
      : toJSString(document._id, 0);

  if (
    documentName &&
    documentName.length > 1 &&
    documentName[0] === "'" &&
    documentName[documentName.length - 1] === "'"
  ) {
    return documentName.substring(1, documentName.length - 1);
  }

  return documentName;
}

export function getFileDisplayNameForDocument(
  document: Document,
  namespace: string,
): string {
  const documentName: string =
    getDisplayNameForDocument(document) ?? 'document';

  let trimmedNamespace: string;
  if (namespace.length > 100) {
    const databaseName = namespace.split('.')[0];
    const collectionName = namespace.slice(databaseName.length + 1);
    trimmedNamespace = `${databaseName.substring(0, 50)}.${collectionName.substring(0, 50)}`;
  } else {
    trimmedNamespace = namespace;
  }
  let displayName = `${trimmedNamespace}: ${documentName}`;

  // Encode special file uri characters to ensure VSCode handles
  // it correctly in a uri while avoiding collisions.
  displayName = displayName.replace(/[\\/%]/gi, function (c) {
    return `%${c.charCodeAt(0).toString(16)}`;
  });

  displayName =
    displayName.length > 200 ? displayName.substring(0, 200) : displayName;

  return displayName;
}
