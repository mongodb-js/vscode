// This file contains testing configuration and the
// globals which vscode embeds
// in webviews and our jest tests need.


const Enzyme = require('enzyme');
const Adapter = require('enzyme-adapter-react-16');
Enzyme.configure({ adapter: new Adapter() });

global.vscodeFake = {
  postMessage: (message) => { }
};

global.acquireVsCodeApi = () => {
  return global.vscodeFake;
};
