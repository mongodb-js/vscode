import { expect } from 'chai';
import sinon from 'sinon';
import { EJSON } from 'bson';

import { PreviewMessageType } from '../../../../views/data-browsing-app/extension-app-message-constants';
import {
  getVSCodeApi,
  sendCancelRequest,
  sendGetDocuments,
  sendGetThemeColors,
  sendEditDocument,
  sendCloneDocument,
  sendDeleteDocument,
  sendInsertDocument,
} from '../../../../views/data-browsing-app/vscode-api';
import { SORT_OPTIONS } from '../../../../views/data-browsing-app/store/documentQuerySlice';

describe('vscode-api test suite', function () {
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    postMessageStub = sinon.stub(getVSCodeApi(), 'postMessage');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getVSCodeApi', function () {
    it('should return the same instance on subsequent calls (singleton)', function () {
      const first = getVSCodeApi();
      const second = getVSCodeApi();
      expect(first).to.equal(second);
    });
  });

  describe('sendCancelRequest', function () {
    it('should send message with cancelRequest command', function () {
      sendCancelRequest();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.cancelRequest,
      });
    });
  });

  describe('sendGetDocuments', function () {
    it('should send message with getDocuments command and pagination params', function () {
      sendGetDocuments({ skip: 10, limit: 25 });

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 10,
        limit: 25,
      });
    });

    it('should send message with getDocuments command with zero skip', function () {
      sendGetDocuments({ skip: 0, limit: 10 });

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });

    it('should send message with sort when sort is provided', function () {
      const sortOption = SORT_OPTIONS[1]; // _id: 1
      sendGetDocuments({ skip: 0, limit: 10, sort: sortOption });

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
        sort: { _id: 1 },
      });
    });

    it('should not include sort field when sort is null', function () {
      sendGetDocuments({ skip: 0, limit: 10, sort: null });

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getDocuments,
        skip: 0,
        limit: 10,
      });
    });
  });

  describe('sendGetThemeColors', function () {
    it('should send message with getThemeColors command', function () {
      sendGetThemeColors();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.getThemeColors,
      });
    });
  });

  describe('sendEditDocument', function () {
    it('should send message with editDocument command and documentId', function () {
      const documentId = '507f1f77bcf86cd799439011';
      sendEditDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.editDocument,
        documentId,
      });
    });

    it('should handle ObjectId format documentId', function () {
      const documentId = { $oid: '507f1f77bcf86cd799439011' };
      sendEditDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.editDocument,
        documentId,
      });
    });

    it('should handle numeric documentId', function () {
      const documentId = 123;
      sendEditDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.editDocument,
        documentId,
      });
    });
  });

  describe('sendCloneDocument', function () {
    it('should send message with cloneDocument command and serialized document', function () {
      const document = EJSON.serialize(
        { _id: '123', name: 'Test', value: 42 },
        { relaxed: false },
      );
      sendCloneDocument(document);

      expect(postMessageStub).to.have.been.calledOnce;
      const call = postMessageStub.firstCall.args[0];
      expect(call.command).to.equal(PreviewMessageType.cloneDocument);
      expect(call.document).to.exist;
      // Document should be serialized with EJSON
      expect(call.document).to.deep.include({
        _id: '123',
        name: 'Test',
        value: { $numberInt: '42' },
      });
    });

    it('should handle document with complex types', function () {
      const document = {
        _id: { $oid: '507f1f77bcf86cd799439011' },
        date: { $date: '2024-01-01T00:00:00Z' },
        nested: { field: 'value' },
      };
      sendCloneDocument(document);

      expect(postMessageStub).to.have.been.calledOnce;
      const call = postMessageStub.firstCall.args[0];
      expect(call.command).to.equal(PreviewMessageType.cloneDocument);
      expect(call.document).to.exist;
    });
  });

  describe('sendDeleteDocument', function () {
    it('should send message with deleteDocument command and documentId', function () {
      const documentId = '507f1f77bcf86cd799439011';
      sendDeleteDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.deleteDocument,
        documentId,
      });
    });

    it('should handle ObjectId format documentId', function () {
      const documentId = { $oid: '507f1f77bcf86cd799439011' };
      sendDeleteDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.deleteDocument,
        documentId,
      });
    });

    it('should handle numeric documentId', function () {
      const documentId = 456;
      sendDeleteDocument(documentId);

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.deleteDocument,
        documentId,
      });
    });
  });

  describe('sendInsertDocument', function () {
    it('should send message with insertDocument command', function () {
      sendInsertDocument();

      expect(postMessageStub).to.have.been.calledOnce;
      expect(postMessageStub).to.have.been.calledWithExactly({
        command: PreviewMessageType.insertDocument,
      });
    });
  });
});
