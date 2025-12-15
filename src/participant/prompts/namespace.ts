import type { InternalPromptPurpose } from '../../telemetry';
import type { PromptArgsBase } from './promptBase';
import { PromptBase } from './promptBase';

const DB_NAME_ID = 'DATABASE_NAME';
const COL_NAME_ID = 'COLLECTION_NAME';

const DB_NAME_REGEX = `${DB_NAME_ID}: (.*)`;
const COL_NAME_REGEX = `${COL_NAME_ID}: (.*)`;

export class NamespacePrompt extends PromptBase<PromptArgsBase> {
  protected getAssistantPrompt(): string {
    return `You are a MongoDB expert.
Parse all user messages to find a database name and a collection name.
Respond in the format:
${DB_NAME_ID}: X
${COL_NAME_ID}: Y
where X and Y are the respective names.
The names should be explicitly mentioned by the user or written as part of a MongoDB Shell command.
If you cannot find the names do not imagine names.
If only one of the names is found, respond only with the found name.
Your response must be concise and correct.

When no names are found, respond with:
No names found.

___
Example 1:
User: How many documents are in the sightings collection in the ufo database?
Response:
${DB_NAME_ID}: ufo
${COL_NAME_ID}: sightings
___
Example 2:
User: How do I create an index in my pineapples collection?
Response:
${COL_NAME_ID}: pineapples
___
Example 3:
User: Where is the best hummus in Berlin?
Response:
No names found.
`;
  }

  extractDatabaseAndCollectionNameFromResponse(text: string): {
    databaseName?: string;
    collectionName?: string;
  } {
    const databaseName = text.match(DB_NAME_REGEX)?.[1].trim();
    const collectionName = text.match(COL_NAME_REGEX)?.[1].trim();
    return { databaseName, collectionName };
  }

  protected get internalPurposeForTelemetry(): InternalPromptPurpose {
    return 'namespace';
  }
}
