import * as vscode from 'vscode';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { ObjectId } from 'bson';
import {
  seedDataAndCreateDataService,
  cleanupTestDB
} from '../dbTestHelper';

const chai = require('chai')
const expect = chai.expect

chai.use(require('chai-as-promised'))

import { PlaygroundController } from '../../../editors';

const sinon = require('sinon');

suite('Playground Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  suite('when user is not connected', () => {
    test('evaluate should throw the missing active connection error', async () => {
      const testConnectionController = new ConnectionController(
        new StatusView(mockExtensionContext),
        mockStorageController
      );
      const testPlaygroundController = new PlaygroundController(mockExtensionContext, testConnectionController);

      expect(testPlaygroundController.evaluate('1 + 1')).to.be.rejectedWith(Error, 'Please connect to a database before running a playground.');
    });
  });

  suite('when user is connected', () => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Text message']);
      },
      client: {}
    };
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    testConnectionController.getActiveConnectionName = () => 'fakeName';

    const testPlaygroundController = new PlaygroundController(mockExtensionContext, testConnectionController);

    test('evaluate should sum numbers', async () => {
      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(await testPlaygroundController.evaluate('1 + 1')).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async () => {
      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(await testPlaygroundController.evaluate(`
        var x = 1;
        x + 2
      `)).to.be.equal('3');
    });

    test('evaluate interaction with a database', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        example: 'field'
      };

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          const actualResult = await testPlaygroundController.evaluate(`
            use('vscodeTestDatabaseAA');
            db.forest.find({})
          `);
          const expectedResult = '[\n' +
            '  {\n' +
            '    _id: 5e32b4d67bf47f4525f2f8ab,\n' +
            '    example: \'field\'\n' +
            '  }\n' +
            ']';

          expect(actualResult).to.be.equal(expectedResult);

          await cleanupTestDB();
        }
      ).then(done, done);
    });

    test('create a new playground instance for each run', () => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f777'),
        valueOfTheField: 'is not important'
      };
      const codeToEvaluate = `
        const x = 1;
        x + 1
      `;

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          await testPlaygroundController.evaluate(codeToEvaluate);

          const result = await testPlaygroundController.evaluate(codeToEvaluate);

          expect(result).to.be.equal('2');

          await cleanupTestDB();
        }
      );
    });

    test('show a confirmation message before running commands in a playground', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        example: 'field'
      };
      const fakeShowInformationMessage = sinon.fake();

      sinon.replace(vscode.window, 'showInformationMessage', fakeShowInformationMessage);

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);
          testPlaygroundController.runAllPlaygroundBlocks().then(() => {
            const expectedMessage =
              'Are you sure you want to run this playground against fakeName?';

            expect(fakeShowInformationMessage.firstArg).to.be.equal(expectedMessage);
          }).then(done, done);

          await cleanupTestDB();
        }
      ).then(done, done);
    });
  });
});
