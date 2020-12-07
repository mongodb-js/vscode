import { FieldType } from './field-type';

export type Schema = {
  count: number;
  fields: FieldType[];
};

export const placeHolderSchema: Schema = {
  count: 0,
  fields: []
};
