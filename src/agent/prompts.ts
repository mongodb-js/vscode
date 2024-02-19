import { EJSON } from 'bson';
import type { Document } from 'mongodb';
import type { SimplifiedSchema } from 'mongodb-schema';
import { SchemaFormatter } from './schema';

export const createUserPromptWithContext = ({
  schema,
  collectionName,
  databaseName,
  sampleDocuments,
}: {
  schema: SimplifiedSchema;
  collectionName: string;
  databaseName: string;
  sampleDocuments: Document[];
}) => {
  const prompt: string[] = [];

  if (databaseName) {
    prompt.push(`Database name: "${databaseName}"`);
  }
  if (collectionName) {
    prompt.push(`Collection name: "${collectionName}"`);
  }

  if (schema && typeof schema === 'object') {
    prompt.push(
      'Schema from a sample of documents from the collection:\n' +
        '```\n' +
        SchemaFormatter.getSchemaFromTypes(schema) +
        '\n```\n'
    );
  }

  if (sampleDocuments && typeof sampleDocuments === 'object') {
    prompt.push(
      `Sample documents from the collection:\n${EJSON.stringify(
        sampleDocuments
      )}`
    );
  }

  return prompt;
};
