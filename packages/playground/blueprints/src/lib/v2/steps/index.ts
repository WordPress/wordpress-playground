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

// Side-effect imports: each module self-registers its handler.
import './filesystem';
import './define-constants';
import './set-site-options';
import './run-php';
import './wp-cli';
import './write-files';
import './install-plugin';
import './activate-plugin';
import './install-theme';
import './activate-theme';
import './set-site-language';
import './unzip';
import './import-content';
import './import-media';
import './import-theme-starter-content';
import './run-sql';
