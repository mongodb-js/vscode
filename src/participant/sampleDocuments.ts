import { toJSString } from 'mongodb-query-parser';
import type { Document } from 'bson';
import { getCopilotModel } from './model';

const MAX_ARRAY_LENGTH_OF_SAMPLE_DOCUMENT_VALUE = 3;

const MAX_STRING_LENGTH_OF_SAMPLE_DOCUMENT_VALUE = 20;

export function getSimplifiedSampleDocuments(obj: Document[]): Document[] {
  function truncate(value: any): any {
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

export async function getStringifiedSampleDocuments({
  prompt,
  sampleDocuments,
}: {
  prompt: string;
  sampleDocuments?: Document[];
}): Promise<string> {
  if (!sampleDocuments?.length) {
    return '';
  }

  const model = await getCopilotModel();
  if (!model) {
    return '';
  }

  let additionToPrompt: Document[] | Document = sampleDocuments;
  let promptInputTokens =
    (await model.countTokens(prompt + toJSString(sampleDocuments))) || 0;

  // First check the length of all stringified sample documents.
  // If the resulting prompt is too large, proceed with only 1 sample document.
  // We also convert an array that contains only 1 element to a single document.
  if (
    promptInputTokens > model.maxInputTokens ||
    sampleDocuments.length === 1
  ) {
    additionToPrompt = sampleDocuments[0];
  }

  const stringifiedDocuments = toJSString(additionToPrompt);

  // TODO: model.countTokens will sometimes return undefined - at least in tests. We should investigate why.
  promptInputTokens =
    (await model.countTokens(prompt + stringifiedDocuments)) || 0;

  // Add sample documents to the prompt only when it fits in the context window.
  if (promptInputTokens <= model.maxInputTokens) {
    return `\nSample document${
      Array.isArray(additionToPrompt) ? 's' : ''
    }: ${stringifiedDocuments}\n`;
  }

  return '';
}
