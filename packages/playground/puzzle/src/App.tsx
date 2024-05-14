import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { Home } from './views/home/Home';
import { Scan } from './views/scan/Scan';
import { Site } from './views/site/Site';

import './App.scss';

const router = createBrowserRouter([
	{
		path: '/puzzle/',
		element: <Home />,
	},
	{
		path: '/puzzle/scan',
		element: <Scan />,
	},
	{
		path: '/puzzle/playground',
		element: <Site />,
	},
]);

export const App = () => {
	return <RouterProvider router={router} />;
};
