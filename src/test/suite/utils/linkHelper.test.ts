import { openLink } from '../../../utils/linkHelper';
import { expect } from 'chai';
import vscode from 'vscode';
import http from 'http';
const sinon = require('sinon');

suite('Open Link Test Suite', () => {
  test('the helper server is instantiated correctly', () => {
    const stubServer = { on: sinon.spy(), listen: sinon.spy() };
    const stubCreateServer = sinon.stub(http, 'createServer').returns(stubServer);
    openLink('https://mongodb.com', 4321);
    expect(stubServer.on.calledWith('connection')).to.be.true;
    expect(stubServer.listen.calledWith(4321)).to.be.true;
    stubCreateServer.restore();
  });

  test('the browser opens correctly', () => {
    const stubServer = sinon.createStubInstance(http.Server, {
      on: sinon.stub(),
      listen: sinon.stub().callsArg(1)
    });
    const stubCreateServer = sinon.stub(http, 'createServer').returns(stubServer);
    const stubExecuteCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();
    openLink('https://mongodb.com', 4321);
    expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
    expect(stubExecuteCommand.firstCall.args[1].path).to.equal(vscode.Uri.parse('https://mongodb.com:4322').path);
    stubExecuteCommand.restore();
    stubCreateServer.restore();
  });
});

