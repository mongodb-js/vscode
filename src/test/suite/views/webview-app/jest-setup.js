// This file contains testing configuration and the globals variables
// that vscode embeds in webviews and our jest tests need.

const Enzyme = require('enzyme');
const Adapter = require('@wojtekmaj/enzyme-adapter-react-17');
const chai = require('chai');
const { TextEncoder, TextDecoder } = require('util');

chai.use(require('sinon-chai'));
Enzyme.configure({ adapter: new Adapter() });

// eslint-disable-next-line no-undef
jest.mock('@iconify-icons/codicon/book', () => {});

// Note applied with js dom so we do manually. (Required by node_modules/mongodb-connection-string-url/node_modules/whatwg-url/lib/encoding.js)
Object.assign(global, { TextDecoder, TextEncoder });

global.vscodeFake = {
  postMessage: (message) => {},
};

global.acquireVsCodeApi = () => {
  return global.vscodeFake;
};
