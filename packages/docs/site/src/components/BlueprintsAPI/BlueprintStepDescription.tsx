import React from 'react';
import { getStepAPI } from './model';

export function BlueprintStepDescription({ name }) {
	const stepApi = getStepAPI(name);

	return (
		<p>
			{stepApi.stepDetails.summary.map((part) => {
				if (part.kind === 'code') {
					return <code>{part.text.replace(/^`|`$/g, '')}</code>;
				}
				return part.text;
			})}
		</p>
	);
}
