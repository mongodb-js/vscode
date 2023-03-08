import React from 'react';
import {
  // createBrowserRouter, // TODO: Based on env, use hash router or browser router.
  createHashRouter,
  RouterProvider,
} from 'react-router-dom';

import { Home } from '../pages/home';

const router = createHashRouter([
  {
    path: '/',
    element: <Home />,
  },
]);

const Root: React.FunctionComponent = () => {
  return <RouterProvider router={router} />;
};

export { Root };
