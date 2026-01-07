import numeral from 'numeral';

export const CollectionType = {
  collection: 'collection',
  view: 'view',
  timeseries: 'timeseries',
} as const;

export type CollectionType =
  (typeof CollectionType)[keyof typeof CollectionType];

export const formatDocCount = (count: number): string => {
  // We format the count (30000 -> 30k) and then display it uppercase (30K).
  return `${numeral(count).format('0a') as string}`.toUpperCase();
};
