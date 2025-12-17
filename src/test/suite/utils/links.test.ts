import { expect } from 'chai';
import LINKS from '../../../utils/links';

const expectedLinks = {
  changelog: 'https://github.com/mongodb-js/vscode/blob/main/CHANGELOG.md',
  feedback:
    'https://feedback.mongodb.com/forums/929236-mongodb-for-vs-code/?utm_source=vscode&utm_medium=product',
  github: 'https://github.com/mongodb-js/vscode',
  reportBug: 'https://github.com/mongodb-js/vscode/issues',
  atlas:
    'https://www.mongodb.com/cloud/atlas?utm_source=vscode&utm_medium=product',
  createAtlasCluster:
    'https://mongodb.com/products/vs-code/vs-code-atlas-signup?ajs_aid=hi&utm_source=vscode&utm_medium=product',
  docs: 'https://docs.mongodb.com/?utm_source=vscode&utm_medium=product',
  mongodbDocs:
    'https://docs.mongodb.com/manual/?utm_source=vscode&utm_medium=product',
  extensionDocs:
    'https://docs.mongodb.com/mongodb-vscode/hi?utm_source=vscode&utm_medium=product',
  aggregationDocs:
    'https://www.mongodb.com/docs/manual/reference/operator/aggregation/hi/?utm_source=vscode&utm_medium=product',
  bsonDocs:
    'https://www.mongodb.com/docs/mongodb-shell/reference/data-types/?utm_source=vscode&utm_medium=product#hi',
  systemVariableDocs:
    'https://www.mongodb.com/docs/manual/reference/aggregation-variables/?utm_source=vscode&utm_medium=product#mongodb-variable-variable.hi',
  ldapDocs:
    'https://docs.mongodb.com/manual/core/security-ldap/?utm_source=vscode&utm_medium=product',
  authDatabaseDocs:
    'https://docs.mongodb.com/manual/core/security-users/?utm_source=vscode&utm_medium=product#user-authentication-database',
  sshConnectionDocs:
    'https://docs.mongodb.com/compass/current/connect/advanced-connection-options/ssh-connection/?utm_source=vscode&utm_medium=product#ssh-connection',
  configureSSLDocs:
    'https://docs.mongodb.com/manual/tutorial/configure-ssl/hi?utm_source=vscode&utm_medium=product',
  pemKeysDocs:
    'https://docs.mongodb.com/manual/reference/configuration-options/?utm_source=vscode&utm_medium=product#net.ssl.PEMKeyPassword',
};

suite('LINKS', function () {
  test('should have all links', function () {
    expect(Object.keys(expectedLinks)).to.deep.eq(Object.keys(LINKS));
  });

  Object.entries(expectedLinks).forEach(([name, expected]) => {
    test(`${name} link should return ${expected}`, function () {
      if (typeof LINKS[name] === 'function') {
        expect(expected).to.eq(LINKS[name]('hi'));
      } else {
        expect(expected).to.eq(LINKS[name]);
      }
    });
  });
});
