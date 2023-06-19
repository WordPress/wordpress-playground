import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import { getStepAPI } from './model';

export function BlueprintStepFunctionExample({ name }) {
	const stepApi = getStepAPI(name);
	if (!stepApi.fnExample) {
		return <span>No example available</span>;
	}
	return <CodeBlock language="ts">{stepApi.fnExample}</CodeBlock>;
}
