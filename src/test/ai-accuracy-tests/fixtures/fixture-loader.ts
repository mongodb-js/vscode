import type { Document, MongoClient } from 'mongodb';

import type { Fixture } from './fixture-type';
import recipes from './recipes';
import getUFOSightingsFixture from './ufo';

export type Fixtures = {
  [dbName: string]: {
    [colName: string]: Document[];
  };
};

type LoadableFixture = (() => Fixture) | Fixture;
const fixturesToLoad: LoadableFixture[] = [recipes, getUFOSightingsFixture];

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

    fixtures[db] = { [coll]: documents };
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
}) {
  await mongoClient.db(db).collection(coll).drop();
  const documents = fixtures[db][coll];
  await mongoClient.db(db).collection(coll).insertMany(documents);
}
