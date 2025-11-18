import type { SiteError } from '../../lib/state/redux/slice-ui';

export const developerErrorTypes = new Set<SiteError>([
	'blueprint-fetch-failed',
	'blueprint-filesystem-required',
	'blueprint-validation-failed',
]);

export const MODAL_TITLES: Partial<Record<SiteError, string>> = {
	'directory-handle-not-found-in-indexeddb':
		'Local directory permissions expired',
	'directory-handle-permission-denied': 'Local directory permissions expired',
	'directory-handle-directory-does-not-exist': 'Local directory was deleted',
	'github-artifact-expired': 'This GitHub artifact expired',
	'blueprint-fetch-failed': 'Blueprint could not be loaded',
	'blueprint-filesystem-required':
		'Bundled resources used outside of a Blueprint bundle',
	'blueprint-validation-failed': 'Blueprint validation error',
	'directory-handle-unknown-error': 'The local directory became unavailable',
	'site-boot-failed': 'Playground crashed',
};

export const DETAIL_SUMMARY_OVERRIDES: Partial<Record<SiteError, string>> = {
	'blueprint-fetch-failed': 'Network error details',
	'blueprint-filesystem-required': 'Resource loader details',
	'blueprint-validation-failed': 'Validation output',
};
