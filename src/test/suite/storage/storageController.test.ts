import assert from 'assert';

import StorageController, {
  StorageVariable,
  StorageLocation,
} from '../../../storage/storageController';
import { ExtensionContextStub } from '../stubs';

suite('Storage Controller Test Suite', () => {
  test('getting a variable gets it from the global context store', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {
      [StorageVariable.GLOBAL_SAVED_CONNECTIONS]: {
        collOne: { name: 'this_gonna_get_saved' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariable.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL,
    );
    assert(
      testVal.collOne.name === 'this_gonna_get_saved',
      `Expected ${testVal} from global state to equal 'this_gonna_get_saved'.`,
    );
  });

  test('getting a variable from the workspace state gets it from the workspace context store', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._workspaceState = {
      [StorageVariable.WORKSPACE_SAVED_CONNECTIONS]: {
        collTwo: { name: 'i_cant_believe_its_gonna_save_this' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariable.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE,
    );
    assert(
      testVal.collTwo.name === 'i_cant_believe_its_gonna_save_this',
      `Expected ${testVal} from workspace state to equal 'i_cant_believe_its_gonna_save_this'.`,
    );
  });

  suite('for a new user that does not have anonymousId', () => {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {};
    const testStorageController = new StorageController(extensionContextStub);

    test('getUserIdentity adds anonymousId to the global storage and returns it to telemetry', () => {
      const userIdentity = testStorageController.getUserIdentity();
      const anonymousId = testStorageController.get(
        StorageVariable.GLOBAL_ANONYMOUS_ID,
      );
      assert.deepStrictEqual(userIdentity, { anonymousId });
    });
  });
});
