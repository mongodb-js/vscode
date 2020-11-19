// This file contains testing configuration and the globals variables
// that vscode embeds in webviews and our jest tests need.

const Enzyme = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
Enzyme.configure({ adapter: new Adapter() });

// eslint-disable-next-line no-undef
jest.mock('@iconify-icons/codicon/book', () => {});

global.vscodeFake = {
  postMessage: (message) => { }
};

global.acquireVsCodeApi = () => {
  return global.vscodeFake;
};
