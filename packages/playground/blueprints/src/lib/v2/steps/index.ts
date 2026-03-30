import type { V2StepHandler } from '../types';

/**
 * Registry of all V2 step handlers, keyed by step name.
 * Handlers are added as they are implemented.
 */
export const v2StepHandlers: Record<string, V2StepHandler> = {};

/**
 * Register a step handler. Called by each step module.
 */
export function registerV2StepHandler(
	stepName: string,
	handler: V2StepHandler
): void {
	v2StepHandlers[stepName] = handler;
}
