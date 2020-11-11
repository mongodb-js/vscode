import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import App from './components/app';

import { initialState, rootReducer } from './store/store';

const store = createStore(rootReducer, initialState);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);
