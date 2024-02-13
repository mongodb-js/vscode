import { EJSON } from 'bson';
import type { Document } from 'mongodb';
import type { SimplifiedSchema } from 'mongodb-schema';
import { SchemaFormatter } from './schema';

// function processSchemaTypes(types, result) {
//   types.forEach((t, i) => {
//     processSchemaType(t, result);

//     if (i !== types.length - 1) {
//       result.append(' | ');
//     }
//   });
// }

// function processDocumentType(doc, result) {
//   if (!doc) {
//     return;
//   }

//   result.append('{');

//   for (const [prop, def] of Object.entries(doc)) {
//     result.nl();
//     result.appendProp(prop);
//     result.append(': ');
//     result.down();
//     processSchemaTypes(def.types, result);
//     result.append(',');
//     result.up();
//   }

//   result.up();
//   result.nl();
//   result.append('}');
//   result.down();
// }

// function processSchemaType(type, result) {
//   if (type.bsonType === 'Document') {
//     processDocumentType(type.fields, result);
//     return;
//   }

//   if (type.bsonType === 'Array') {
//     result.append('Array<');
//     processSchemaTypes(type.types, result);
//     result.append('>');
//     return;
//   }

//   result.append(type.bsonType);
// }

// export function formatSchema(schema) {
//   const result = {
//     str: '',
//     level: 1,
//     nl: () => {
//       result.append('\n');
//       result.append(' '.repeat(result.level * 2));
//     },
//     appendProp: (prop) => {
//       if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(prop)) {
//         result.append(prop);
//       } else {
//         result.append(JSON.stringify(prop));
//       }
//     },
//     append: (newchars: string) => {
//       result.str = result.str + newchars;
//     },
//     down() {
//       result.level++;
//     },
//     up() {
//       result.level--;
//     },
//   };

//   processDocumentType(schema, result);
//   return `type Doc = ${result.str}`;
// }

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
