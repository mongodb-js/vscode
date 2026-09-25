import { EJSON, type Document } from 'bson';

/**
 * Builds the filter addressing a single document by its `_id`.
 *
 * The `$eq` wrapper is what makes this safe. Without it, an `_id` that happens
 * to be a query operator object - `{ $exists: true }`, which `$group` can lift
 * out of a stored field - is parsed as a wildcard filter and matches every
 * document. With it the server compares the value literally, and refuses the
 * operation outright when the value is operator-shaped.
 */
export function documentIdFilter(documentId: any): Document {
  return { _id: { $eq: documentId } };
}

/** Renders an `_id` for a user to read, in every message that shows one. */
export function formatDocumentIdForDisplay(documentId: any): string {
  return JSON.stringify(EJSON.serialize(documentId, { relaxed: false }));
}

/**
 * Explains an `_id` that addressed no document.
 *
 * @param fromQuery whether the row came from a query, or undefined where the
 * caller cannot tell. A query result's `_id` is whatever the pipeline produced,
 * so it need not address a document at all - worth saying, because "not found"
 * about a row on screen is otherwise baffling.
 */
export function unmatchedDocumentIdMessage(
  documentId: any,
  namespace: string,
  fromQuery?: boolean,
): string {
  const id = formatDocumentIdForDisplay(documentId);
  const opening = `No document in ${namespace} has the _id ${id}.`;

  if (fromQuery === true) {
    return `${opening} These are query results, so this row's _id may be a value the query produced rather than a stored document's _id.`;
  }

  if (fromQuery === false) {
    return `${opening} It may have been deleted or changed since the view was loaded.`;
  }

  return `${opening} If this row came from a query, its _id may be a value the query produced rather than a stored document's _id.`;
}
