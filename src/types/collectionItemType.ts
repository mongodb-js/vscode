export type CollectionItem = {
  name: string;
  type?: string;
  options?: object,
  info?: { readOnly: boolean; uuid: object[] },
  idIndex?: { v: number; key: object[]; name: string; ns: string }
};
