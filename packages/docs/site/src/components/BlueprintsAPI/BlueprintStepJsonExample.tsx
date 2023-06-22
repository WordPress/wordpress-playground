import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import { getStepAPI } from './model';

export function BlueprintStepJsonExample({ name }) {
	const stepApi = getStepAPI(name);
	if (!stepApi.stepExample) {
		return <span>No example available</span>;
	}
	return <CodeBlock language="json">{stepApi.stepExample}</CodeBlock>;
}
