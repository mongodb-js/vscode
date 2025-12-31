import { EventEmitter } from 'events';
import { afterEach } from 'mocha';
import { expect } from 'chai';
import http from 'http';
import sinon from 'sinon';
import vscode from 'vscode';

import { openLink } from '../../../utils/linkHelper';

suite('Open Link Test Suite', function () {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('the helper server is instantiated correctly', function () {
    const stubServer: any = { on: sandbox.spy(), listen: sandbox.spy() };
    const stubCreateServer: any = sinon
      .stub(http, 'createServer')
      .returns(stubServer);
    void openLink('https://mongodb.com', 4321);
    expect(stubServer.on.calledWith('connection')).to.be.true;
    expect(stubServer.listen.calledWith(4321)).to.be.true;
    stubCreateServer.restore();
  });

  test('the browser opens correctly for mongodb.com', function () {
    const stubServer: any = {
      on: sandbox.stub(),
      listen: sandbox.stub().callsArg(1),
    };
    const stubCreateStubInstance: any = sandbox.createStubInstance(
      http.Server,
      stubServer,
    );
    const stubCreateServer: any = sinon
      .stub(http, 'createServer')
      .returns(stubCreateStubInstance);
    const stubExecuteCommand: any = sinon
      .stub(vscode.commands, 'executeCommand')
      .resolves();
    void openLink('https://mongodb.com', 4321);
    expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
    expect(stubExecuteCommand.firstCall.args[1].authority).to.equal(
      vscode.Uri.parse('http://localhost:4321').authority,
    );
    stubExecuteCommand.restore();
    stubCreateServer.restore();
  });

  test('the browser opens correctly for a subdomain of mongodb.com', function () {
    const stubServer: any = {
      on: sandbox.stub(),
      listen: sandbox.stub().callsArg(1),
    };
    const stubCreateStubInstance: any = sandbox.createStubInstance(
      http.Server,
      stubServer,
    );
    const stubCreateServer: any = sinon
      .stub(http, 'createServer')
      .returns(stubCreateStubInstance);
    const stubExecuteCommand: any = sinon
      .stub(vscode.commands, 'executeCommand')
      .resolves();
    void openLink('https://monkey.mongodb.com', 4321);
    expect(stubExecuteCommand.firstCall.args[0]).to.equal('vscode.open');
    expect(stubExecuteCommand.firstCall.args[1].authority).to.equal(
      vscode.Uri.parse('http://localhost:4321').authority,
    );
    stubExecuteCommand.restore();
    stubCreateServer.restore();
  });

  test('handles errors', function (done) {
    class EventEmitterStub extends EventEmitter {
      listen(): void {}
    }
    const eventEmitterStub: any = new EventEmitterStub();
    const createServerStub: any = sinon
      .stub(http, 'createServer')
      .returns(eventEmitterStub);
    openLink('https://mongodb.com', 4321).catch((e) => {
      expect(e.message).to.equal('some error');
      createServerStub.restore();
      done();
    });
    eventEmitterStub.emit('error', new Error('some error'));
  });

  test('does not allow insecure connections', function (done) {
    openLink('http://mongodb.com', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });

  test('does not allow untrusted urls', function (done) {
    openLink('https://mongobd.com', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });

  test('does not allow untrusted urls that contain mongodb.com', function (done) {
    openLink('https://mongodb.com.foo.dev', 4321).catch((e) => {
      expect(e.message).to.equal('untrusted url');
      done();
    });
  });
});
