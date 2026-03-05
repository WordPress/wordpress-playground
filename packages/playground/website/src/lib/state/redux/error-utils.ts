import { FirewallInterferenceError } from '@php-wasm/web-service-worker';

/**
 * Search through an error's cause chain to find a FirewallInterferenceError.
 * Checks both instanceof and the error's name property to handle cases where
 * instanceof fails due to module boundaries or error serialization.
 *
 * Returns the FirewallInterferenceError if found, or undefined if not.
 */
export function findFirewallErrorInCauseChain(
	error: unknown
): FirewallInterferenceError | Error | undefined {
	let current: unknown = error;
	while (current) {
		if (current instanceof FirewallInterferenceError) {
			return current;
		}
		if (
			current instanceof Error &&
			current.name === 'FirewallInterferenceError'
		) {
			return current;
		}
		current =
			current instanceof Error ? (current as Error).cause : undefined;
	}
	return undefined;
}
