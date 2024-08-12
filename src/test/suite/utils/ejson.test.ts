import { expect } from 'chai';
import { getEJSON } from '../../../utils/ejson';

suite('getEJSON', function () {
  suite('Valid uuid', function () {
    const prettyUuid = {
      $uuid: '63b985b8-e8dd-4bda-9087-e4402f1a3ff5',
    };
    const rawUuid = {
      $binary: {
        base64: 'Y7mFuOjdS9qQh+RALxo/9Q==',
        subType: '04',
      },
    };

    test('Simplifies top-level uuid', function () {
      const ejson = getEJSON({ uuid: rawUuid });
      expect(ejson).to.deep.equal({ uuid: prettyUuid });
    });

    test('Simplifies nested uuid', function () {
      const ejson = getEJSON({
        grandparent: {
          parent: {
            sibling: 1,
            uuid: rawUuid,
          },
        },
      });
      expect(ejson).to.deep.equal({
        grandparent: {
          parent: {
            sibling: { $numberInt: 1 },
            uuid: prettyUuid,
          },
        },
      });
    });

    test('Simplifies uuid in a nested array', function () {
      const ejson = getEJSON({
        items: [
          {
            parent: {
              sibling: 1,
              uuid: rawUuid,
            },
          },
        ],
      });
      expect(ejson).to.deep.equal({
        items: [
          {
            parent: {
              sibling: { $numberInt: 1 },
              uuid: prettyUuid,
            },
          },
        ],
      });
    });
  });

  suite('Invalid uuid or not an uuid', function () {
    test('Ignores another subtype', function () {
      const document = {
        $binary: {
          base64: 'Y7mFuOjdS9qQh+RALxo/9Q==',
          subType: '02',
        },
      };
      const ejson = getEJSON(document);
      expect(ejson).to.deep.equal(document);
    });

    test('Ignores invalid uuid', function () {
      const document = {
        $binary: {
          base64: 'Y7m==',
          subType: '04',
        },
      };
      const ejson = getEJSON(document);
      expect(ejson).to.deep.equal(document);
    });

    test('Ignores null', function () {
      const document = {
        $binary: {
          base64: null,
          subType: '04',
        },
      };
      const ejson = getEJSON(document);
      expect(ejson).to.deep.equal(document);
    });
  });
});
