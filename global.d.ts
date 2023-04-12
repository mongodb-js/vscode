import type {
  FindCursor,
  AggregationCursor,
} from '@mongosh/service-provider-core';
import {
  Document,
  FindOptions,
  ExplainVerbosityLike,
} from '@mongosh/service-provider-core';

declare global {
  let use: (dbName: string) => void;

  enum Stages {
    match = '$match',
  }

  let db: {
    getCollection(coll: string): {
      find(
        query?: Document,
        projection?: Document,
        options?: FindOptions
      ): Promise<FindCursor>;
      aggregate(
        pipeline: [{ [key in Stages]: Document }],
        options: Document & {
          explain?: never;
        }
      ): Promise<AggregationCursor>;
      aggregate(
        pipeline: [{ [key in Stages]: Document }],
        options: Document & {
          explain: ExplainVerbosityLike;
        }
      ): Promise<Document>;
      aggregate(
        ...stages: [{ [key in Stages]: Document }]
      ): Promise<AggregationCursor>;
    };
  };
}

export {};
