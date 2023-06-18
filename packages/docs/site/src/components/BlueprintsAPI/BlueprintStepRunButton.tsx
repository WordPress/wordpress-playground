import React from 'react';
import { getStepAPI } from './model';
import { BlueprintRunButton } from '../Blueprints/BlueprintRunButton';

export function BlueprintStepRunButton({ name }) {
	const stepApi = getStepAPI(name);
	const blueprintExample = stepApi.stepDetails?.examples?.[0]?.inBlueprint;
	if (!blueprintExample) {
		return null;
	}
	return <BlueprintRunButton blueprint={blueprintExample} />;
}
