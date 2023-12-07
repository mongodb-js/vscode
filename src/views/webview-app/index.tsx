import * as React from 'react';
import * as ReactDOM from 'react-dom';

import App from './app';
// import './reset.less';

import { resetGlobalCSS } from './reset-css';

resetGlobalCSS();
ReactDOM.render(<App />, document.getElementById('root'));
