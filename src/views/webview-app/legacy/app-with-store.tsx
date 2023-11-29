import * as React from 'react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import App from './components/app';

import { initialState, rootReducer } from './store/store';

const store = createStore(rootReducer, initialState);

export default () => (
  <Provider store={store}>
    <App />
  </Provider>
);
