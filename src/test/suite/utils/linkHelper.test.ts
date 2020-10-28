import { openLink } from '../../../utils/linkHelper';
import { expect } from 'chai';
import vscode from 'vscode';
import http from 'http';
import { EventEmitter } from 'events';
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

  test('the browser opens correctly for mongodb.com', () => {
    const stubServer = sinon.createStubInstance(http.Server, {
      on: sinon.stub(),
      listen: sinon.stub().callsArg(1)
    });
    const stubCreateServer = sinon.stub(http, 'createServer').returns(stubServer);
    const stubExecuteCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();
    openLink('https://mongodb.com', 4321);
    expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
    expect(stubExecuteCommand.firstCall.args[1].authority).to.equal(vscode.Uri.parse('http://localhost:4321').authority);
    stubExecuteCommand.restore();
    stubCreateServer.restore();
  });

  test('the browser opens correctly for a subdomain of mongodb.com', () => {
    const stubServer = sinon.createStubInstance(http.Server, {
      on: sinon.stub(),
      listen: sinon.stub().callsArg(1)
    });
    const stubCreateServer = sinon.stub(http, 'createServer').returns(stubServer);
    const stubExecuteCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();
    openLink('https://monkey.mongodb.com', 4321);
    expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
    expect(stubExecuteCommand.firstCall.args[1].authority).to.equal(vscode.Uri.parse('http://localhost:4321').authority);
    stubExecuteCommand.restore();
    stubCreateServer.restore();
  });

  test('handles errors', (done) => {
    class MockedServer extends EventEmitter {
      listen() { }
    }
    const mockedServer = new MockedServer();
    const stubCreateServer = sinon.stub(http, 'createServer').returns(mockedServer);
    openLink('https://mongodb.com', 4321).catch((e) => {
      expect(e.message).to.equal('some error');
      stubCreateServer.restore();
      done();
    });
    mockedServer.emit('error', new Error('some error'));
  });

  test('does not allow insecure connections', (done) => {
    openLink('http://mongodb.com', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });

  test('does not allow untrusted urls', (done) => {
    openLink('https://mongobd.com', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });

  test('does not allow untrusted urls that contain mongodb.com', (done) => {
    openLink('https://mongodb.com.foo.dev', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });
});

