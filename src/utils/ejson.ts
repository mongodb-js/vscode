import { EJSON } from 'bson';
import type { Document } from 'bson';

const isObjectOrArray = (value: unknown) =>
  value !== null && typeof value === 'object';

function simplifyEJSON(item: Document[] | Document): Document {
  if (!isObjectOrArray(item)) return item;

  if (Array.isArray(item)) {
    return item.map((arrayItem) =>
      isObjectOrArray(arrayItem) ? simplifyEJSON(arrayItem) : arrayItem
    );
  }

  // UUIDs might be represented as {"$uuid": <canonical textual representation of a UUID>} in EJSON
  // Binary subtypes 3 or 4 are used to represent UUIDs in BSON
  // But, parsers MUST interpret the $uuid key as BSON Binary subtype 4
  // For this reason, we are applying this representation for subtype 4 only
  // see https://github.com/mongodb/specifications/blob/master/source/extended-json.rst#special-rules-for-parsing-uuid-fields
  if (
    item.$binary?.subType === '04' &&
    typeof item.$binary?.base64 === 'string'
  ) {
    const hexString = Buffer.from(item.$binary.base64, 'base64').toString(
      'hex'
    );
    const match = /^(.{8})(.{4})(.{4})(.{4})(.{12})$/.exec(hexString);
    if (!match) return item;
    const asUUID = match.slice(1, 6).join('-');
    return { $uuid: asUUID };
  }

  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      isObjectOrArray(value) ? simplifyEJSON(value) : value,
    ])
  );
}

export function getEJSON(item: Document[] | Document) {
  const ejson = EJSON.serialize(item);
  return simplifyEJSON(ejson);
}
