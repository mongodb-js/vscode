import { ConnectTool } from './metadata/connect';
import { ListCollectionsTool } from './metadata/listCollections';
import { CollectionIndexesTool } from './read/collectionIndexes';
import { ListDatabasesTool } from './metadata/listDatabases';
import { CreateIndexTool } from './create/createIndex';
import { CollectionSchemaTool } from './metadata/collectionSchema';
import { FindTool } from './read/find';
import { InsertManyTool } from './create/insertMany';
import { DeleteManyTool } from './delete/deleteMany';
import { CollectionStorageSizeTool } from './metadata/collectionStorageSize';
import { CountTool } from './read/count';
import { DbStatsTool } from './metadata/dbStats';
import { AggregateTool } from './read/aggregate';
import { UpdateManyTool } from './update/updateMany';
import { RenameCollectionTool } from './update/renameCollection';
import { DropDatabaseTool } from './delete/dropDatabase';
import { DropCollectionTool } from './delete/dropCollection';
import { ExplainTool } from './metadata/explain';
import { CreateCollectionTool } from './create/createCollection';
import { LogsTool } from './metadata/logs';

export const MongoDbTools = [
  ConnectTool,
  ListCollectionsTool,
  ListDatabasesTool,
  CollectionIndexesTool,
  CreateIndexTool,
  CollectionSchemaTool,
  FindTool,
  InsertManyTool,
  DeleteManyTool,
  CollectionStorageSizeTool,
  CountTool,
  DbStatsTool,
  AggregateTool,
  UpdateManyTool,
  RenameCollectionTool,
  DropDatabaseTool,
  DropCollectionTool,
  ExplainTool,
  CreateCollectionTool,
  LogsTool,
];
