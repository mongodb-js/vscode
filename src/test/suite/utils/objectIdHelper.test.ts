import vscode from 'vscode';
import { expect } from 'chai';

import { createIdFactory, generateId } from '../../../utils/objectIdHelper';

const CONFIG_SECTION = 'mdb';
const CONFIG_NAME = 'uniqueObjectIdPerCursor';

suite('ObjectId Test Suite', () => {
  test('succesfully creates an ObjectId', () => {
    expect(() => generateId()).not.to.throw();
  });

  test('should generate the same ObjectId when config is false', async () => {
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update(CONFIG_NAME, false);

    const idFactory = createIdFactory();
    const ids = [idFactory(), idFactory()];

    expect(ids[0]).to.equal(ids[1]);
  });

  test('should generate unique ObjectIds when config is true', async () => {
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update(CONFIG_NAME, true);

    const idFactory = createIdFactory();
    const ids = [idFactory(), idFactory()];

    expect(ids[0]).to.not.equal(ids[1]);
  });
});
