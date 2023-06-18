import React from 'react';
import { getStepAPI } from './model';

export function BlueprintStepParameters({ name }) {
	const stepApi = getStepAPI(name);
	return (
		<ul>
			{stepApi.stepDetails?.props
				?.filter((prop) => prop.name !== 'step')
				.map((prop) => (
					<li key={prop.name}>
						<b>{prop.name}</b>
						{prop.type.name ? ` (${prop.type.name}) ` : ''}
						{prop.description ? ` – ${prop.description}` : ''}
					</li>
				))}
		</ul>
	);
}
