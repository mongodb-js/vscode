import assert from 'assert';

const { contributes } = require('../../../../package.json');

import { ConnectionItemContextValues } from '../../../explorer/connectionTreeItem';

suite('ConnectionTreeItem Test Suite', () => {
  test('its context value should be in the package json', function () {
    let connectedRegisteredCommandInPackageJson = false;
    let disconnectedRegisteredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(ConnectionItemContextValues.connected)) {
        connectedRegisteredCommandInPackageJson = true;
      }
      if (contextItem.when.includes(ConnectionItemContextValues.disconnected)) {
        disconnectedRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      connectedRegisteredCommandInPackageJson,
      'Expected connected connection tree item to be registered with a command in package json'
    );
    assert(
      disconnectedRegisteredCommandInPackageJson,
      'Expected disconnected connection tree item to be registered with a command in package json'
    );
  });
});
