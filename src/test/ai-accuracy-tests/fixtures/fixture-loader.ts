import type { Document, MongoClient } from 'mongodb';
import { getSimplifiedSchema } from 'mongodb-schema';

import type { Fixture } from './fixture-type';
import antiques from './antiques';
import pets from './pets';
import pineapples from './pineapples';
import recipes from './recipes';
import getUFOSightingsFixture from './ufo';
import { SchemaFormatter } from '../../../participant/schema';

export type Fixtures = {
  [dbName: string]: {
    [colName: string]: {
      documents: Document[];
      schema: string; // Result of formatted simplified schema.
    };
  };
};

type LoadableFixture = (() => Fixture) | Fixture;
const fixturesToLoad: LoadableFixture[] = [
  antiques,
  pets,
  pineapples,
  recipes,
  getUFOSightingsFixture,
];

export async function loadFixturesToDB({
  mongoClient,
}: {
  mongoClient: MongoClient;
}): Promise<Fixtures> {
  const fixtures: Fixtures = {};

  // Load dynamic fixtures.
  for (const fixtureToLoad of fixturesToLoad) {
    const { db, coll, documents } =
      typeof fixtureToLoad === 'function' ? fixtureToLoad() : fixtureToLoad;

    const unformattedSchema = await getSimplifiedSchema(documents);
    const schema = new SchemaFormatter().format(unformattedSchema);

    fixtures[db] = {
      [coll]: {
        documents,
        schema,
      },
    };
    await mongoClient.db(db).collection(coll).insertMany(documents);
  }

  return fixtures;
}

export async function reloadFixture({
  db,
  coll,
  mongoClient,
  fixtures,
}: {
  db: string;
  coll: string;
  mongoClient: MongoClient;
  fixtures: Fixtures;
}): Promise<void> {
  await mongoClient.db(db).collection(coll).drop();
  const { documents } = fixtures[db][coll];
  await mongoClient.db(db).collection(coll).insertMany(documents);
}
