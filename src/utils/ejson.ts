import { EJSON } from 'bson';
import type { Document } from 'bson';

const isObject = (value: unknown) =>
  value !== null && typeof value === 'object';

function simplifyEJSON(documents: Document[] | Document): Document {
  if (!isObject(documents)) return documents;

  if (Array.isArray(documents)) {
    return documents.map((item) =>
      isObject(item) ? simplifyEJSON(item) : item
    );
  }

  // UUIDs might be represented as {"$uuid": <canonical textual representation of a UUID>} in EJSON
  // Binary subtypes 3 or 4 are used to represent UUIDs in BSON
  // But, parsers MUST interpret the $uuid key as BSON Binary subtype 4
  // For this reason, we are applying this representation for subtype 4 only
  // see https://github.com/mongodb/specifications/blob/master/source/extended-json.rst#special-rules-for-parsing-uuid-fields
  if (
    Object.prototype.hasOwnProperty.call(documents, '$binary') &&
    documents.$binary?.subType === '04' &&
    typeof documents.$binary.base64 === 'string'
  ) {
    const hexString = Buffer.from(documents.$binary.base64, 'base64').toString(
      'hex'
    );
    const match = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/.exec(hexString);
    if (!match) return documents;
    const asUUID = match.slice(1, 6).join('-');
    return { $uuid: asUUID };
  }

  return Object.fromEntries(
    Object.entries(documents).map(([key, value]) => [
      key,
      isObject(value) ? simplifyEJSON(value) : value,
    ])
  );
}

export function getEJSON(documents: Document[] | Document) {
  const ejson = JSON.parse(EJSON.stringify(documents));
  return simplifyEJSON(ejson);
}
