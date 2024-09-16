import React from 'react';
import PathMappingControlDemo from './PathMappingControl/demo';

import { createRoot } from 'react-dom/client';

// @TODO: Explore a Storybook setup instead of a custom demos page.

const components = [
	{
		name: 'PathMappingControl',
		component: PathMappingControlDemo,
	},
];

function Demos() {
	return (
		<>
			{components.map((component) => {
				const Component = component.component;
				return (
					<div key={component.name}>
						<h2>{component.name}</h2>
						<Component key={component.name} />
					</div>
				);
			})}
		</>
	);
}

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<Demos />);
