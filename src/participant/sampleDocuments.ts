import type { Document } from 'bson';
import { toJSString } from 'mongodb-query-parser';

const MAX_ARRAY_LENGTH_OF_SAMPLE_DOCUMENT_VALUE = 3;

const MAX_STRING_LENGTH_OF_SAMPLE_DOCUMENT_VALUE = 20;

export function formatSampleDocuments(obj: Document) {
  return toJSString(format(obj));
}

function format(obj: Document) {
  function truncate(value) {
    if (typeof value === 'string') {
      return value.slice(0, MAX_STRING_LENGTH_OF_SAMPLE_DOCUMENT_VALUE);
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        value = value.slice(0, MAX_ARRAY_LENGTH_OF_SAMPLE_DOCUMENT_VALUE);
      }
      // Recursively truncate strings in nested objects or arrays.
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          value[key] = truncate(value[key]);
        }
      }
    }
    return value;
  }

  return truncate(obj);
}
