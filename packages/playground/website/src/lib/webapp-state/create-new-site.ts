import { Blueprint, StepDefinition } from '@wp-playground/blueprints';
import { logTrackingEvent } from '../tracking';

export function createNewSite(blueprint: Blueprint) {
	// Log the names of provided Blueprint's steps.
	// Only the names (e.g. "runPhp" or "login") are logged. Step options like
	// code, password, URLs are never sent anywhere.
	const steps = (blueprint?.steps || [])
		?.filter((step: any) => !!(typeof step === 'object' && step?.step))
		.map((step) => (step as StepDefinition).step);
	for (const step of steps) {
		logTrackingEvent('step', { step });
	}
}
