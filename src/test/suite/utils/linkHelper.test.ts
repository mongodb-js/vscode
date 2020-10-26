import { openLink } from '../../../utils/linkHelper';
import { expect } from 'chai';
import vscode from 'vscode';
import http from 'http';
const sinon = require('sinon');

suite('Open Link Test Suite', () => {
  test('the helper server is instantiated correctly', () => {
    const stubServer = { on: sinon.spy(), listen: sinon.spy() };
    const stubCreateServer = sinon.fake.returns(stubServer);
    sinon.replace(http, 'createServer', stubCreateServer);
    openLink('https://mongodb.com', 4321);
    expect(stubServer.on.calledWith('connection')).to.be.true;
    expect(stubServer.listen.calledWith(4321)).to.be.true;
  });

  // test('the browser opens correctly', async () => {
  //   const stubExecuteCommand = sinon.fake.resolves();
  //   sinon.replace(vscode.commands, 'executeCommand', stubExecuteCommand);
  //   await openLink('https://mongodb.com', 4321);
  //   expect(stubExecuteCommand.called).to.be.true;
  //   expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
  //   expect(stubExecuteCommand.firstCall.args[1].path).to.equal(vscode.Uri.parse('https://mongodb.com:4322').path);
  // });
});

