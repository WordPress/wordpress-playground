import React from 'react';
import { getStepAPI } from './model.tsx';

export function BlueprintStepDescription({ name }) {
	const stepApi = getStepAPI(name);

	return <p>{stepApi.stepDetails.summary}</p>;
}
