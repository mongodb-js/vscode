import { EJSON, type Document } from 'bson';
import { stringify } from 'javascript-stringify';
import { toJSString } from 'mongodb-query-parser';

/**
 * Sentinel class used to represent a BSON value that could not be
 * deserialized from EJSON.  The custom stringifier (`toDisplayString`)
 * recognises instances of this class and emits an unquoted
 * `Invalid <Type>` literal in the output.
 */
export class InvalidBSONValue {
  readonly typeName: string;
  constructor(typeName: string) {
    this.typeName = typeName;
  }
}

/**
 * Returns a human-readable label derived from the first `$`-prefixed key in
 * `obj`, or `null` if the object has no such key.  Used only as a fallback
 * label when EJSON.deserialize throws for this value.
 *
 * Examples: `$numberLong` → `"Long"`,  `$date` → `"Date"`.
 */
function labelFromDollarKey(obj: Record<string, unknown>): string | null {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      // Strip the leading "$" and common prefixes like "number"
      const raw = key.slice(1);
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
  }
  return null;
}

/**
 * Returns `true` if `val` looks like a successfully-deserialized BSON
 * value (i.e. it is no longer a plain EJSON type wrapper).
 */
function isDeserializedBsonValue(val: unknown): boolean {
  if (val === null || typeof val !== 'object') return false;
  if ('_bsontype' in (val as Record<string, unknown>)) return true;
  if (val instanceof Date) return true;
  if (val instanceof RegExp) return true;
  return false;
}

/**
 * Attempts to deserialize a single EJSON value by wrapping it in a parent
 * document and calling `EJSON.deserialize`.
 *
 * Returns the deserialized BSON value on success, an `InvalidBSONValue`
 * sentinel when the value is a recognized EJSON type wrapper that cannot
 * be deserialized, or `null` when the value is not an EJSON type wrapper
 * (i.e. it is a regular sub-document that should be recursed into).
 */
function tryDeserializeValue(
  value: Record<string, unknown>,
): unknown | null {
  try {
    const result = EJSON.deserialize(
      { _: value } as unknown as Document,
      { relaxed: false },
    );
    const deserialized = (result as Record<string, unknown>)._;

    if (isDeserializedBsonValue(deserialized)) {
      // Special-case: `{ $date: 'pineapple' }` produces an Invalid Date
      // rather than throwing.
      if (deserialized instanceof Date && isNaN(deserialized.getTime())) {
        return new InvalidBSONValue('Date');
      }
      return deserialized;
    }

    // EJSON didn't convert it into a BSON type → treat as a regular object.
    return null;
  } catch {
    // EJSON recognised it as a type wrapper but the value is invalid.
    return new InvalidBSONValue(labelFromDollarKey(value) ?? 'Value');
  }
}

/**
 * Recursively walks an EJSON-serialized value and deserialises it field by
 * field.  When a single EJSON type wrapper (e.g. `{ $numberLong: "NaN" }`)
 * cannot be deserialized, an `InvalidBSONValue` instance is substituted so
 * that the rest of the document is still visible.
 */
function walkAndDeserialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(walkAndDeserialize);
  }

  const obj = value as Record<string, unknown>;

  // Try to deserialize as a single EJSON type wrapper first.
  const attempted = tryDeserializeValue(obj);
  if (attempted !== null) {
    return attempted;
  }

  // Regular object – recurse into its properties.
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, val] of Object.entries(obj)) {
    result[key] = walkAndDeserialize(val);
  }
  return result;
}

/**
 * Deserializes an EJSON-serialized document gracefully: fields whose EJSON
 * values are invalid are replaced with `InvalidBSONValue` instances instead
 * of throwing an error for the whole document.
 */
export function gracefullyDeserializeEjson(
  document: Record<string, unknown>,
): Record<string, unknown> {
  return walkAndDeserialize(document) as Record<string, unknown>;
}

/**
 * Converts a deserialized document (which may contain `InvalidBSONValue`
 * instances) into a shell-syntax display string.
 *
 * Uses `javascript-stringify` directly (the same engine behind
 * `mongodb-query-parser`'s `toJSString`) with a custom replacer that:
 *  - emits `Invalid <Type>` as an unquoted literal for `InvalidBSONValue`
 *  - delegates to `toJSString` for recognised BSON types
 *  - falls through to the default stringifier for everything else
 */
export function toDisplayString(
  doc: Record<string, unknown>,
  indent = 2,
): string {
  return (
    stringify(
      doc,
      (value, _indent, defaultStringify) => {
        if (value instanceof InvalidBSONValue) {
          return `Invalid ${value.typeName}`;
        }

        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          '_bsontype' in value
        ) {
          return toJSString(value) ?? defaultStringify(value);
        }

        return defaultStringify(value);
      },
      indent,
    ) ?? ''
  );
}

