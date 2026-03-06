import { BSON } from 'bson';

export function serializeBSON(value: unknown): string {
  return Buffer.from(BSON.serialize({ value })).toString('base64');
}

export function deserializeBSON(data: string): any {
  return BSON.deserialize(Buffer.from(data, 'base64')).value;
}
