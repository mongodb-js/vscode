import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './components/app';

import Store from './store/store';
import StoreConnector from './components/storeConnector';

import './connect.module.less';

ReactDOM.render(
  (
    <StoreConnector store={Store}>
      <App {...this.props} />
    </StoreConnector>
  ),
  document.getElementById('root')
);
