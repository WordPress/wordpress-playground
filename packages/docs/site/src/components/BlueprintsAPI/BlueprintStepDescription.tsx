import React from 'react';
import { getStepAPI } from './model';
import ReactMarkdown from 'react-markdown';

export function BlueprintStepDescription({ name }) {
	const stepApi = getStepAPI(name);

	const summary = stepApi.stepDetails.summary
		.map((part) => {
			if (part.kind === 'code') {
				return '`' + part.text.replace(/^`|`$/g, '') + '`';
			}
			return part.text;
		})
		.join(' ');

	return <ReactMarkdown>{summary}</ReactMarkdown>;
}
