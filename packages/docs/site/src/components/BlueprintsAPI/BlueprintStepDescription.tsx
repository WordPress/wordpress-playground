import React from 'react';
import { getStepAPI } from './model';

export function BlueprintStepDescription({ name }) {
	const stepApi = getStepAPI(name);

	return <p>{stepApi.stepDetails.summary}</p>;
}
