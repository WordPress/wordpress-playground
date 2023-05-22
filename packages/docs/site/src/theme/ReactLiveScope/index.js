import React from 'react';
// import { startPlaygroundWeb } from '@wp-playground/client';

// Add react-live imports you need here
const ReactLiveScope = {
	React,
	...React,
	// startPlaygroundWeb,
	css: {
		textarea: {
			width: '100%',
			height: '8lh',
			display: 'block',
		},
	},
	HTML: ({ children }) => {
		return <div dangerouslySetInnerHTML={{ __html: children }} />;
	},
};

export default ReactLiveScope;
