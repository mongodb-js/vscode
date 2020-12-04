import { EJSON } from 'bson';
import { v4 as uuidv4 } from 'uuid';

// In order to provide opening documents with various _id types we need
// to pass the _id from the document to open to vscode's document provider.
// So that when we open a document we have an id in the uri which corresponds
// to the document's _id in the `_ids` map.
// We can't store the _id on the uri itself as the _id can potentially be large.
export default class DocumentIdStore {
  _ids: { [key: string]: EJSON.SerializableTypes } = {};

  add(_id: EJSON.SerializableTypes): string {
    const key = uuidv4();

    this._ids[key] = _id;

    return key;
  }

  get(key: string): EJSON.SerializableTypes {
    return this._ids[key];
  }

  remove(key: string): void {
    delete this._ids[key];
  }
}
