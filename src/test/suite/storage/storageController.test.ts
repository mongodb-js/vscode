import { expect } from 'chai';

import StorageController, {
  StorageVariable,
  StorageLocation,
} from '../../../storage/storageController';
import { ExtensionContextStub } from '../stubs';

suite('Storage Controller Test Suite', function () {
  test('getting a variable gets it from the global context store', function () {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {
      [StorageVariable.globalSavedConnections]: {
        collOne: { name: 'this_gonna_get_saved' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariable.globalSavedConnections,
      StorageLocation.global,
    );
    expect(testVal.collOne.name).to.equal('this_gonna_get_saved');
  });

  test('getting a variable from the workspace state gets it from the workspace context store', function () {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._workspaceState = {
      [StorageVariable.workspaceSavedConnections]: {
        collTwo: { name: 'i_cant_believe_its_gonna_save_this' },
      },
    };
    const testStorageController = new StorageController(extensionContextStub);
    const testVal = testStorageController.get(
      StorageVariable.workspaceSavedConnections,
      StorageLocation.workspace,
    );
    expect(testVal.collTwo.name).to.equal('i_cant_believe_its_gonna_save_this');
  });

  suite('for a new user that does not have anonymousId', function () {
    const extensionContextStub = new ExtensionContextStub();
    extensionContextStub._globalState = {};
    const testStorageController = new StorageController(extensionContextStub);

    test('getUserIdentity adds anonymousId to the global storage and returns it to telemetry', function () {
      const userIdentity = testStorageController.getUserIdentity();
      const anonymousId = testStorageController.get(
        StorageVariable.globalAnonymousId,
      );
      expect(userIdentity).to.deep.equal({ anonymousId });
    });
  });
});
