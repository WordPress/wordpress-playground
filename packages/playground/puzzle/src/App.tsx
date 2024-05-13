import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { Home } from './views/home/Home.tsx';
import { Scan } from './views/scan/Scan.tsx';
import { Site } from './views/site/Site.tsx';

import './App.scss';

const router = createBrowserRouter([
	{
		path: '/',
		element: <Home />,
	},
	{
		path: '/scan',
		element: <Scan />,
	},
	{
		path: '/playground',
		element: <Site />,
	},
]);

export const App = () => {
	return <RouterProvider router={router} />;
};
