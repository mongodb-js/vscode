import { afterEach, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import vscode from 'vscode';

import { confirmConnection } from '../../../utils/confirmConnection';

suite('Confirm Connection Test Suite', function () {
  let sandbox: sinon.SinonSandbox;
  let showWarningMessageStub: SinonStub;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(function () {
    sandbox.restore();
  });

  test('asks the question with the redacted connection string as the detail', async function () {
    showWarningMessageStub.resolves('Connect');

    await confirmConnection({
      connectionString: 'mongodb+srv://user:s3cr3t@cluster0.example.com/admin',
      question: 'Do the thing?',
      action: 'Connect',
    });

    const [question, options, action] = showWarningMessageStub.firstCall
      .args as [string, { modal: boolean; detail: string }, string];
    expect(question).to.equal('Do the thing?');
    expect(action).to.equal('Connect');
    expect(options.modal).to.be.true;
    expect(options.detail).to.include('cluster0.example.com');
    expect(options.detail).to.not.include('s3cr3t');
  });

  test('is confirmed only when the action is picked', async function () {
    showWarningMessageStub.resolves('Connect');
    expect(
      await confirmConnection({
        connectionString: 'mongodb://localhost:27017',
        question: 'Do the thing?',
        action: 'Connect',
      }),
    ).to.be.true;

    showWarningMessageStub.resolves(undefined);
    expect(
      await confirmConnection({
        connectionString: 'mongodb://localhost:27017',
        question: 'Do the thing?',
        action: 'Connect',
      }),
    ).to.be.false;
  });

  test('redacts credentials from a connection string it cannot parse', async function () {
    showWarningMessageStub.resolves(undefined);

    await confirmConnection({
      connectionString: 'mongodb://bob:p4ssw0rd@',
      question: 'Do the thing?',
      action: 'Connect',
    });

    const [, options] = showWarningMessageStub.firstCall.args as [
      string,
      { detail: string },
    ];
    expect(options.detail).to.not.include('p4ssw0rd');
  });
});
