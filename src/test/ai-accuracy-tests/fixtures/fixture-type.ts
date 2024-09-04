import type { Document } from 'mongodb';

export type Fixture = {
  db: string;
  coll: string;
  documents: Document[];
};
